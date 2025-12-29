"""
Script to check available Gemini models in the project.
"""
import os

# Set credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "credentials.json"

from google import genai

# Initialize client with Vertex AI
client = genai.Client(
    vertexai=True,
    project="lustrous-center-482511-v1",
    location="us-central1"
)

print("=" * 60)
print("Available Gemini Models in your project:")
print("=" * 60)

try:
    # List available models
    models = client.models.list()
    
    for model in models:
        print(f"\n📌 Model: {model.name}")
        if hasattr(model, 'display_name'):
            print(f"   Display Name: {model.display_name}")
        if hasattr(model, 'description'):
            print(f"   Description: {model.description[:100]}..." if model.description and len(model.description) > 100 else f"   Description: {model.description}")
        if hasattr(model, 'supported_generation_methods'):
            print(f"   Methods: {model.supported_generation_methods}")
            
except Exception as e:
    print(f"Error listing models: {e}")

print("\n" + "=" * 60)
print("Testing specific model versions:")
print("=" * 60)

# Test specific model names
test_models = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002", 
    "gemini-1.5-pro",
    "gemini-1.5-pro-001",
    "gemini-1.5-pro-002",
    "gemini-1.0-pro",
    "gemini-pro",
]

for model_name in test_models:
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Say hello in one word"
        )
        print(f"✅ {model_name}: WORKS - Response: {response.text.strip()}")
    except Exception as e:
        error_msg = str(e)[:80]
        print(f"❌ {model_name}: FAILED - {error_msg}")
