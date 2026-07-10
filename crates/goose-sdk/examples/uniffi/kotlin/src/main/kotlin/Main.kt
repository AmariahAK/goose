import io.aaif.goose.MessageRole
import io.aaif.goose.ProviderMessage
import io.aaif.goose.ProviderModelConfig
import io.aaif.goose.providers.openai.OpenAiProvider
import io.aaif.goose.providers.openai.defaultModel

fun main() {
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

    val stream = provider.stream(
        model,
        "You are a knowledgeable geography expert.",
        messages,
    )

    while (true) {
        val chunk = stream.next() ?: break
        chunk.text?.let { print(it) }
        chunk.usageJson?.let { println("\nusage: $it") }
    }
    println()
}
