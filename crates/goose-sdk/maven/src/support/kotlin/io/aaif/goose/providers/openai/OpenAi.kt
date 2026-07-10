package io.aaif.goose.providers.openai

public fun provider(apiKey: String): io.aaif.goose.Provider = io.aaif.goose.openaiProvider(apiKey)

public fun defaultModel(): String = io.aaif.goose.openaiDefaultModel()
