import React, { useState } from "react";
import { Button } from "@strapi/design-system";
import { Alert } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";
import { useCMEditViewDataManager } from "@strapi/helper-plugin";
import { ArrowRight } from "@strapi/icons";
import axios from "axios";

const STAGING_API_KEY =
  "28232b77d3bb3b0e2a8accdb950ea79494cc47820804dbcb6fa52b8b2f2fb2b03dcd3f38eea240d3b8287e738c6a8609d2894c4dc04b6f78e137a8953d8326b934f0981e22042dacf708d3e758781f187c7c028f84d8cddb21b41f38b3233eb8edb05c40f4953c50951f4b82cd4df1695a0b69c0df1305f497de3540adf05d92";
const PRODUCTION_API_KEY =
  "e1f51abb94af282f14a5527cc5081347d4f3261c7f077e0a5b39e3fe80749661ea3e99ad2e8fafdc99cee250a0c67d2db8d9ae28814c189b38d47727fba8aa6ef9738fe47f57c7edb49d69870bfb2ec1ceb9818c04af64051b46c0b18522ee3e4627e67b44d673fbcd1cfcf3b424d1cc01cfc71c13a5e4aee92ed7b9d11bebd5";

const createAxiosInstance = (token) =>
  axios.create({
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

const productionAxios = createAxiosInstance(PRODUCTION_API_KEY);
const stagingAxios = createAxiosInstance(STAGING_API_KEY);

const SyncAllButton = () => {
  const { slug } = useCMEditViewDataManager();
  const [alert, setAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const getApiPath = (contentTypeSlug) => {
    const singular = contentTypeSlug.split(".").pop();
    return `${singular}s`;
  };

  const STAGING_API_URL = `http://localhost:1337/api/${getApiPath(slug)}`;
  const PRODUCTION_API_URL = `http://localhost:1338/api/${getApiPath(slug)}`;
  const PRODUCTION_UPLOAD_URL = `http://localhost:1338/api/upload`;

  const uploadMediaToProduction = async (fileUrl) => {
    try {
      //download the file from staging
      const stageResponse = await stagingAxios.get(fileUrl, {
        responseType: "blob",
      });

      const file = new File([stageResponse.data], fileUrl.split("/").pop(), {
        type: stageResponse.data.type,
      });

      const formData = new FormData();
      formData.append("files", file);

      const uploadResponse = await productionAxios.post(
        PRODUCTION_UPLOAD_URL,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return uploadResponse.data[0].id;
    } catch (error) {
      console.error("Error uploading media:", error);
      throw new Error("Failed to upload media file");
    }
  };

  const processMediaFields = async (data) => {
    const processedData = { ...data };

    const processNestedFields = async (obj) => {
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === "object") {
          if (Array.isArray(obj[key])) {
            // Handle arrays
            const processedArray = [];
            for (const item of obj[key]) {
              if (item && typeof item === "object") {
                if (item.url && item.mime) {
                  // Handle media object in array
                  const newMediaId = await uploadMediaToProduction(item.url);
                  processedArray.push(newMediaId);
                } else {
                  // Handle nested object in array
                  processedArray.push(await processNestedFields(item));
                }
              } else {
                // Handle primitive values in array
                processedArray.push(item);
              }
            }
            obj[key] = processedArray;
          } else if (obj[key].url && obj[key].mime) {
            // Handle single media object
            const newMediaId = await uploadMediaToProduction(obj[key].url);
            obj[key] = newMediaId;
          } else {
            // Handle nested object
            await processNestedFields(obj[key]);
          }
        }
      }
      return obj;
    };

    return await processNestedFields(processedData);
  };

  const syncContentToProduction = async (contentData) => {
    try {
      const stageId = contentData.id.toString();
      let existingContent = null;

      try {
        const response = await productionAxios.get(
          `${PRODUCTION_API_URL}?filters[stageId][$eq]=${stageId}`
        );

        const items = response?.data?.data;
        if (items && items.length > 0) {
          existingContent = items.find(
            (item) => item?.attributes?.stageId === stageId
          );
        }
      } catch (checkError) {
        console.warn(
          `Content with stageId ${stageId} not found, will create new entry.`
        );
      }

      // Process media fields before preparing the data
      const processedContentData = await processMediaFields(contentData);

      const preparedData = {
        ...processedContentData,
        stageId: stageId,
        locale: undefined,
        publishedAt: new Date().toISOString(),
        createdAt: undefined,
        updatedAt: undefined,
        documentId: undefined,
        id: undefined,
      };

      if (existingContent) {
        const contentId = existingContent.id;
        await productionAxios.put(`${PRODUCTION_API_URL}/${contentId}`, {
          data: preparedData,
        });
        return true;
      } else {
        await productionAxios.post(PRODUCTION_API_URL, {
          data: preparedData,
        });
        return true;
      }
    } catch (error) {
      console.error("Error syncing content to Production:", error);
      throw new Error(
        error.response?.data?.error?.message ||
          "Error syncing content to Production"
      );
    }
  };

  const fetchAllContent = async () => {
    try {
      let page = 1;
      const pageSize = 100;
      let allContent = [];
      let hasMore = true;

      while (hasMore) {
        const response = await stagingAxios.get(
          `${STAGING_API_URL}?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=deep`
        );

        const { data, meta } = response.data;
        allContent = [...allContent, ...data];

        hasMore = page * pageSize < meta.pagination.total;
        page++;
      }

      return allContent;
    } catch (error) {
      console.error("Error fetching content:", error);
      throw new Error("Failed to fetch content from staging");
    }
  };

  const handleSyncAll = async () => {
    try {
      setIsLoading(true);
      setProgress({ current: 0, total: 0 });

      const allContent = await fetchAllContent();
      setProgress({ current: 0, total: allContent.length });

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < allContent.length; i++) {
        try {
          const content = {
            ...allContent[i].attributes,
            id: allContent[i].id,
          };

          await syncContentToProduction(content);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to sync item ${allContent[i].id}:`, error);
        }
        setProgress({ current: i + 1, total: allContent.length });
      }

      setAlert({
        type: successCount > 0 ? "success" : "danger",
        message: `Sync completed: ${successCount} succeeded, ${failedCount} failed`,
      });
    } catch (error) {
      setAlert({
        type: "danger",
        message: error.message,
      });
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }

    setTimeout(() => setAlert(null), 5000);
  };

  return (
    <Flex direction="column" gap={2} style={{ width: "100%" }}>
      <Button
        onClick={handleSyncAll}
        variant="secondary"
        startIcon={<ArrowRight />}
        loading={isLoading}
        disabled={isLoading}
        fullWidth
      >
        {isLoading
          ? `Syncing ${progress.current}/${progress.total}`
          : "Sync all to production"}
      </Button>

      {alert && (
        <Alert
          closeLabel="Close alert"
          title={alert.type === "success" ? "Success!" : "Error!"}
          variant={alert.type}
          onClose={() => setAlert(null)}
          action={
            <Button variant="danger" onClick={() => setAlert(null)}>
              Close
            </Button>
          }
        >
          {alert.message}
        </Alert>
      )}
    </Flex>
  );
};

export default SyncAllButton;
