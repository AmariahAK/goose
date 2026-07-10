import io.aaif.goose.MessageRole
import io.aaif.goose.ProviderMessage
import io.aaif.goose.ProviderModelConfig
import io.aaif.goose.providers.openai.OpenAiProvider
import io.aaif.goose.providers.openai.defaultModel
import io.aaif.goose.providers.openai.streamFlow
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    val apiKey = System.getenv("OPENAI_API_KEY")
    require(!apiKey.isNullOrBlank()) {
        "Set OPENAI_API_KEY before running this example."
    }

    val provider = OpenAiProvider(apiKey)
    val model = ProviderModelConfig(modelName = defaultModel())
    val messages = listOf(
        ProviderMessage(
            role = MessageRole.USER,
            text = "What is the capital of France? Answer in one sentence.",
        ),
    )

    provider
        .streamFlow(
            model,
            "You are a knowledgeable geography expert.",
            messages,
        )
        .collect { chunk ->
            chunk.text?.let { print(it) }
            chunk.usageJson?.let { println("\nusage: $it") }
        }
    println()
}
