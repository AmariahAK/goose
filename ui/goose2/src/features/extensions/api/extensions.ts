import { getClient } from "@/shared/api/acpConnection";
import type { ExtensionConfig, ExtensionEntry } from "../types";

export async function listExtensions(): Promise<ExtensionEntry[]> {
  const client = await getClient();
  const response = await client.goose.GooseConfigExtensions({});
  return response.extensions as ExtensionEntry[];
}

export async function listSessionExtensions(
  sessionId: string,
): Promise<ExtensionConfig[]> {
  const client = await getClient();
  const response = await client.goose.GooseSessionExtensions({
    sessionId,
  });
  return (response.extensions ?? []) as ExtensionConfig[];
}

export async function addExtension(
  name: string,
  extensionConfig: ExtensionConfig,
): Promise<void> {
  const client = await getClient();
  await client.goose.GooseConfigExtensionsAdd({
    name,
    extensionConfig,
    enabled: true,
  });
}

export async function removeExtension(configKey: string): Promise<void> {
  const client = await getClient();
  await client.goose.GooseConfigExtensionsRemove({ configKey });
}

export async function setExtensionEnabled(
  configKey: string,
  enabled: boolean,
): Promise<void> {
  const client = await getClient();
  await client.goose.GooseConfigExtensionsToggle({
    configKey,
    enabled,
  });
}
