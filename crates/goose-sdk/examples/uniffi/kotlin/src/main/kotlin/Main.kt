import io.aaif.goose.MessageRole
import io.aaif.goose.ProviderMessage
import io.aaif.goose.ProviderModelConfig
import io.aaif.goose.providers.databricks.DatabricksProvider
import io.aaif.goose.providers.databricks.defaultModel

fun main() {
    val host = System.getenv("DATABRICKS_HOST")
    require(!host.isNullOrBlank()) {
        "Set DATABRICKS_HOST before running this example."
    }

    val token = System.getenv("DATABRICKS_TOKEN")
    require(!token.isNullOrBlank()) {
        "Set DATABRICKS_TOKEN to a Databricks API token before running this example."
    }

    val provider = DatabricksProvider(host, token)
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
