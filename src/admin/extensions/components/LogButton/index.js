import React, { useState } from "react";
import { Button } from "@strapi/design-system";
import { Alert } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";
import { useCMEditViewDataManager } from "@strapi/helper-plugin";
import { Plane } from "@strapi/icons";
import axios from "axios";

const API_KEY =
  "e1f51abb94af282f14a5527cc5081347d4f3261c7f077e0a5b39e3fe80749661ea3e99ad2e8fafdc99cee250a0c67d2db8d9ae28814c189b38d47727fba8aa6ef9738fe47f57c7edb49d69870bfb2ec1ceb9818c04af64051b46c0b18522ee3e4627e67b44d673fbcd1cfcf3b424d1cc01cfc71c13a5e4aee92ed7b9d11bebd5";

const axiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
});

const LogButton = () => {
  const { modifiedData, initialData, slug, isSingleType } =
    useCMEditViewDataManager();
  const [alert, setAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getApiPath = (contentTypeSlug) => {
    const singular = contentTypeSlug.split(".").pop();
    return `${singular}s`;
  };

  const PRODUCTION_API_URL = `http://localhost:1338/api/${getApiPath(slug)}`;
  const PRODUCTION_UPLOAD_URL = `http://localhost:1338/api/upload`;

  const uploadMediaToProduction = async (fileUrl) => {
    try {
      // Download the file from staging
      const stageResponse = await axios.get(fileUrl, { responseType: "blob" });
      const file = new File([stageResponse.data], fileUrl.split("/").pop(), {
        type: stageResponse.data.type,
      });

      // Create FormData for upload
      const formData = new FormData();
      formData.append("files", file);

      // Upload to production
      const uploadResponse = await axiosInstance.post(
        PRODUCTION_UPLOAD_URL,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return uploadResponse.data[0].id; // Return the new media ID
    } catch (error) {
      console.error("Error uploading media:", error);
      throw new Error("Failed to upload media file");
    }
  };

  const processMediaFields = async (data) => {
    const processedData = { ...data };

    // Recursive function to process nested objects and arrays
    const processNestedFields = async (obj) => {
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === "object") {
          if (Array.isArray(obj[key])) {
            // Handle arrays of media or nested objects
            for (let i = 0; i < obj[key].length; i++) {
              if (obj[key][i] && typeof obj[key][i] === "object") {
                if (obj[key][i].url && obj[key][i].mime) {
                  // if it looks like a media object
                  const newMediaId = await uploadMediaToProduction(
                    obj[key][i].url
                  );
                  obj[key][i] = newMediaId;
                } else {
                  // Recursive call for nested objects in arrays
                  await processNestedFields(obj[key][i]);
                }
              }
            }
          } else if (obj[key].url && obj[key].mime) {
            // This is a media object
            const newMediaId = await uploadMediaToProduction(obj[key].url);
            obj[key] = newMediaId;
          } else {
            // Recursive call for nested objects
            await processNestedFields(obj[key]);
          }
        }
      }
    };

    await processNestedFields(processedData);
    return processedData;
  };

  const syncContentToProduction = async (contentData) => {
    try {
      const stageId = contentData.id.toString();
      let existingContent = null;

      try {
        const response = await axiosInstance.get(
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
        const updateResponse = await axiosInstance.put(
          `${PRODUCTION_API_URL}/${contentId}`,
          { data: preparedData }
        );

        return {
          success: true,
          message: "Content and media updated successfully in Production.",
          id: contentId,
        };
      } else {
        const createResponse = await axiosInstance.post(PRODUCTION_API_URL, {
          data: preparedData,
        });

        return {
          success: true,
          message: "Content and media published successfully to Production.",
          id: createResponse.data.data.id,
        };
      }
    } catch (error) {
      console.error("Error syncing content to Production:", error);
      throw new Error(
        error.response?.data?.error?.message ||
          "Error syncing content to Production"
      );
    }
  };

  const handleClick = async () => {
    try {
      setIsLoading(true);

      const result = await syncContentToProduction({
        ...modifiedData,
        id: initialData.id,
      });

      setAlert({
        type: "success",
        message: `${result.message} (ID: ${result.id})`,
      });
    } catch (error) {
      console.error("Sync error:", error);
      setAlert({
        type: "danger",
        message: error.message,
      });
    } finally {
      setIsLoading(false);
    }

    setTimeout(() => setAlert(null), 5000);
  };

  return (
    <Flex direction="column" gap={2} style={{ width: "100%" }}>
      <Button
        onClick={handleClick}
        variant="primary"
        startIcon={<Plane />}
        loading={isLoading}
        disabled={isLoading}
        fullWidth
      >
        Publish to production
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

export default LogButton;
