import React from "react";
import { Button } from "@strapi/design-system";
import { useCMEditViewDataManager } from "@strapi/helper-plugin";
import { Plane } from "@strapi/icons";

const LogButton = () => {
  const { modifiedData, initialData } = useCMEditViewDataManager();

  const handleClick = () => {
    // Log the entry ID
    console.log("Entry ID:", initialData.id);
  };

  return (
    <Button onClick={handleClick} variant="primary" startIcon={<Plane />}>
      Publish to production
    </Button>
  );
};

export default LogButton;
