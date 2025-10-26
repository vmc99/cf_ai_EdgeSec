#!/usr/bin/env python3
"""
Upload embeddings to Vectorize via Worker endpoint
"""

import json
import requests
import sys

WORKER_URL = 'http://localhost:8787'
EMBEDDINGS_FILE = '../data/embeddings.jsonl'

def load_documents():
    """Load documents from embeddings.jsonl"""
    documents = []
    with open(EMBEDDINGS_FILE, 'r') as f:
        for line in f:
            if line.strip():
                documents.append(json.loads(line))
    return documents

def main():
    print("Loading documents...")
    documents = load_documents()
    print(f"Loaded {len(documents)} documents")
    
    print(f"\nUploading to {WORKER_URL}/admin/populate-embeddings...")
    
    response = requests.post(
        f'{WORKER_URL}/admin/populate-embeddings',
        json={'documents': documents},
        headers={'Content-Type': 'application/json'}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n✅ Success!")
        print(f"  Processed: {result['processed']}")
        print(f"  Uploaded: {result['uploaded']}")
        print(f"  Message: {result['message']}")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)
        sys.exit(1)

if __name__ == '__main__':
    main()
