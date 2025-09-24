export type RGBA = { r: number; g: number; b: number; a: number };
export type VariableAlias = { type: "VARIABLE_ALIAS"; id: string };

export type CollectionInfo = {
   id: string;
   name: string;
   defaultModeId: string;
   modes: { id: string; name: string }[];
   variableCount: number;
};

export type ExportRequest = {
   includeByCollection: Record<string, boolean | undefined>;
   skipEmpty?: boolean;
};
