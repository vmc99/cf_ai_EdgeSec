"""
Generate embeddings using Cloudflare Workers AI and upload to Vectorize
Requires: CLOUDFLARE_ACCOUNT_ID and CF_API_TOKEN environment variables
"""

import json
import os
import requests
import sys
from typing import List, Dict, Any

# Configuration
ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
API_TOKEN = os.getenv('CF_API_TOKEN')
VECTORIZE_INDEX = 'edgesec-docs'
EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
EMBEDDINGS_FILE = '../data/embeddings.jsonl'

def load_text_chunks() -> List[Dict[str, Any]]:
    """Load text chunks from embeddings.jsonl"""
    chunks = []
    filepath = os.path.join(os.path.dirname(__file__), EMBEDDINGS_FILE)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                chunks.append(json.loads(line))
    
    print(f"Loaded {len(chunks)} text chunks")
    return chunks

def generate_embedding(text: str) -> List[float]:
    """Generate embedding using Cloudflare Workers AI"""
    if not ACCOUNT_ID or not API_TOKEN:
        raise ValueError("CLOUDFLARE_ACCOUNT_ID and CF_API_TOKEN must be set")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{EMBEDDING_MODEL}"
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # Truncate text if too long (max ~512 tokens for most models)
    if len(text) > 2000:
        text = text[:2000]
    
    payload = {'text': text}
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    
    result = response.json()
    return result['result']['data'][0]

def upload_to_vectorize(vectors: List[Dict[str, Any]]) -> bool:
    """Upload vectors to Vectorize index"""
    if not ACCOUNT_ID or not API_TOKEN:
        raise ValueError("CLOUDFLARE_ACCOUNT_ID and CF_API_TOKEN must be set")
    
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/vectorize/v2/indexes/{VECTORIZE_INDEX}/insert"
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/x-ndjson'
    }
    
    # Convert to NDJSON format
    ndjson_data = '\n'.join(json.dumps(v) for v in vectors)
    
    response = requests.post(url, headers=headers, data=ndjson_data)
    response.raise_for_status()
    
    result = response.json()
    return result.get('success', False)

def main():
    """Main execution"""
    try:
        print("Starting embedding generation and upload...")
        print(f"Account ID: {ACCOUNT_ID[:8]}..." if ACCOUNT_ID else "Account ID: NOT SET")
        print(f"API Token: {'Set' if API_TOKEN else 'NOT SET'}")
        
        if not ACCOUNT_ID or not API_TOKEN:
            print("\nError: Missing credentials")
            print("Set CLOUDFLARE_ACCOUNT_ID and CF_API_TOKEN environment variables")
            print("\nExample:")
            print("  export CLOUDFLARE_ACCOUNT_ID='your-account-id'")
            print("  export CF_API_TOKEN='your-api-token'")
            sys.exit(1)
        
        # Load text chunks
        chunks = load_text_chunks()
        
        # Generate embeddings for each chunk
        vectors = []
        for i, chunk in enumerate(chunks):
            print(f"Generating embedding {i+1}/{len(chunks)}...", end='\r')
            
            try:
                embedding = generate_embedding(chunk['text'])
                vectors.append({
                    'id': chunk['id'],
                    'values': embedding,
                    'metadata': chunk.get('metadata', {})
                })
            except Exception as e:
                print(f"\n⚠️  Warning: Failed to generate embedding for {chunk['id']}: {e}")
                continue
        
        print(f"\n✓ Generated {len(vectors)} embeddings")
        
        # Upload to Vectorize in batches (API limit: 100 vectors per request)
        batch_size = 100
        total_batches = (len(vectors) + batch_size - 1) // batch_size
        
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i:i + batch_size]
            batch_num = i // batch_size + 1
            print(f"Uploading batch {batch_num}/{total_batches} ({len(batch)} vectors)...", end='\r')
            
            try:
                upload_to_vectorize(batch)
            except Exception as e:
                print(f"\n❌ Error uploading batch {batch_num}: {e}")
                sys.exit(1)
        
        print(f"\n✅ Successfully uploaded {len(vectors)} vectors to Vectorize index '{VECTORIZE_INDEX}'")
        
        # Save embeddings locally for reference
        output_file = os.path.join(os.path.dirname(__file__), '../data/embeddings_with_vectors.jsonl')
        with open(output_file, 'w', encoding='utf-8') as f:
            for vector in vectors:
                f.write(json.dumps(vector) + '\n')
        
        print(f"✓ Saved embeddings to {output_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
