import os

# Tests never call AWS. Fake credentials let modules create their boto3 clients at import.
os.environ.update(AWS_ACCESS_KEY_ID="test", AWS_SECRET_ACCESS_KEY="test", AWS_DEFAULT_REGION="ap-south-1",
                  AWS_CONFIG_FILE=os.devnull)
os.environ.pop("AWS_PROFILE", None)
