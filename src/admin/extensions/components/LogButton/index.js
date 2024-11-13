import React, { useState } from "react";
import { Button } from "@strapi/design-system";
import { Alert } from "@strapi/design-system";
import { Flex } from "@strapi/design-system";
import { useCMEditViewDataManager } from "@strapi/helper-plugin";
import { Plane } from "@strapi/icons";
import axios from "axios";

const PRODUCTION_API_URL = "http://localhost:1338/api/articles";
const API_KEY =
  "e1f51abb94af282f14a5527cc5081347d4f3261c7f077e0a5b39e3fe80749661ea3e99ad2e8fafdc99cee250a0c67d2db8d9ae28814c189b38d47727fba8aa6ef9738fe47f57c7edb49d69870bfb2ec1ceb9818c04af64051b46c0b18522ee3e4627e67b44d673fbcd1cfcf3b424d1cc01cfc71c13a5e4aee92ed7b9d11bebd5";

const axiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
});

const LogButton = () => {
  const { modifiedData, initialData } = useCMEditViewDataManager();
  const [alert, setAlert] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const syncContentToProduction = async (contentData) => {
    try {
      // Extract the stageId (using current entry's ID as stageId)
      const stageId = contentData.id.toString();
      let existingContent = null;

      try {
        const response = await axiosInstance.get(
          `${PRODUCTION_API_URL}?filters[stageId][$eq]=${stageId}`
        );

        // Check for existing content
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

      const preparedData = {
        ...contentData,
        stageId: stageId,
        // Remove unnecessary fields
        locale: undefined,
        publishedAt: new Date().toISOString(),
        createdAt: undefined,
        updatedAt: undefined,
        documentId: undefined,
        id: undefined,
      };

      if (existingContent) {
        // Update existing content
        const contentId = existingContent.id;
        const updateResponse = await axiosInstance.put(
          `${PRODUCTION_API_URL}/${contentId}`,
          { data: preparedData }
        );

        return {
          success: true,
          message: "Content updated successfully in Production.",
          id: contentId,
        };
      } else {
        // Create new content
        const createResponse = await axiosInstance.post(PRODUCTION_API_URL, {
          data: preparedData,
        });

        return {
          success: true,
          message: "Content published successfully to Production.",
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
