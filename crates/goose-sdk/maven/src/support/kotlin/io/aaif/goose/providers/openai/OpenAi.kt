package io.aaif.goose.providers.openai

import io.aaif.goose.ProviderMessage
import io.aaif.goose.ProviderModelConfig
import io.aaif.goose.ProviderStreamChunk
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

public typealias OpenAiProvider = io.aaif.goose.OpenAiProvider

public fun defaultModel(): String = io.aaif.goose.openaiDefaultModel()

public fun OpenAiProvider.streamFlow(
    model: ProviderModelConfig,
    system: String,
    messages: List<ProviderMessage>,
): Flow<ProviderStreamChunk> = flow {
    val stream = stream(model, system, messages)
    while (true) {
        emit(stream.next() ?: break)
    }
}
