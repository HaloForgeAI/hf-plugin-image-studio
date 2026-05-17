import { AppSelect, type AppSelectProps } from "@haloforge/plugin-sdk";
import { useState } from "react";

export function ClosingAppSelect({ onChange, ...props }: AppSelectProps) {
  const [revision, setRevision] = useState(0);

  return (
    <AppSelect
      key={revision}
      {...props}
      onChange={(event) => {
        onChange?.(event);
        setRevision((value) => value + 1);
      }}
    />
  );
}
