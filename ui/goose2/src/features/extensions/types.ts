export interface StdioExtensionConfig {
  type: "stdio";
  name: string;
  description: string;
  cmd: string;
  args: string[];
  envs?: Record<string, string>;
  env_keys?: string[];
  timeout?: number;
  bundled?: boolean;
  available_tools?: string[];
}

export interface BuiltinExtensionConfig {
  type: "builtin";
  name: string;
  description: string;
  display_name?: string;
  timeout?: number;
  bundled?: boolean;
  available_tools?: string[];
}

export interface PlatformExtensionConfig {
  type: "platform";
  name: string;
  description: string;
  display_name?: string;
  bundled?: boolean;
  available_tools?: string[];
}

export interface StreamableHttpExtensionConfig {
  type: "streamable_http";
  name: string;
  description: string;
  uri: string;
  envs?: Record<string, string>;
  env_keys?: string[];
  headers?: Record<string, string>;
  timeout?: number;
  bundled?: boolean;
  available_tools?: string[];
}

export interface SseExtensionConfig {
  type: "sse";
  name: string;
  description: string;
  uri?: string;
  bundled?: boolean;
}

export type ExtensionConfig =
  | StdioExtensionConfig
  | BuiltinExtensionConfig
  | PlatformExtensionConfig
  | StreamableHttpExtensionConfig
  | SseExtensionConfig;

export type ExtensionEntry = ExtensionConfig & {
  config_key: string;
  enabled: boolean;
};

export type ExtensionConnectionStatus =
  | "connected"
  | "failed"
  | "available"
  | "unavailable";

export type SessionExtensionStatus = ExtensionConfig & {
  config_key: string;
  status: ExtensionConnectionStatus;
  tools: string[];
  error?: string;
};

export function getDisplayName(ext: ExtensionConfig): string {
  if ((ext.type === "builtin" || ext.type === "platform") && ext.display_name) {
    return ext.display_name;
  }
  return ext.name;
}
