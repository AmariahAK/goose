package io.aaif.goose.providers.databricks

public fun provider(host: String, token: String): io.aaif.goose.Provider =
    io.aaif.goose.databricksProvider(host, token)

public fun defaultModel(): String = io.aaif.goose.databricksDefaultModel()
