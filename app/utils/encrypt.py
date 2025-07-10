import base64

import bcrypt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa


SALT_ROUNDS = 10


def hash_password(password: str) -> str:
    """
    Hash password using bcrypt
    """
    if not password:
        raise ValueError("Password cannot be empty")
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt(SALT_ROUNDS))
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify password matches hashed password
    """
    if not password or not hashed_password:
        return False

    try:
        password_bytes = password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def decrypt_with_private_key(encrypted_data: str, private_key_pem: str) -> str:
    """
    Decrypt data using RSA private key
    """
    try:
        # Load private key
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"), password=None, backend=default_backend()
        )
        # Type assertion to ensure it's an RSA private key
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise ValueError("Private key must be an RSA key")

        # Decode base64 encrypted data
        encrypted_bytes = base64.b64decode(encrypted_data)

        # Decrypt
        decrypted_bytes = private_key.decrypt(
            encrypted_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt data: {str(e)}")


def decrypt_long_text_with_private_key(
    encrypted_data: str, private_key_pem: str
) -> str:
    """
    Decrypt long text data using RSA private key
    This function handles longer text that might be split into chunks
    """
    try:
        # Load private key
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode("utf-8"), password=None, backend=default_backend()
        )
        # Type assertion to ensure it's an RSA private key
        if not isinstance(private_key, rsa.RSAPrivateKey):
            raise ValueError("Private key must be an RSA key")

        # Decode base64 encrypted data
        encrypted_bytes = base64.b64decode(encrypted_data)

        # Decrypt
        decrypted_bytes = private_key.decrypt(
            encrypted_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt long text: {str(e)}")
