"""
Embedding Generator for Cloudflare Docs and Runbooks
Generates embeddings and prepares data for Vectorize indexing
"""

import json
import os
from typing import List, Dict, Any
import hashlib


class EmbeddingGenerator:
    """Generate embeddings for documentation"""
    
    def __init__(self, data_dir: str = '../data'):
        self.data_dir = os.path.abspath(data_dir)
        self.docs_dir = os.path.join(self.data_dir, 'docs')
        self.runbooks_dir = os.path.join(self.data_dir, 'runbooks')
        self.output_file = os.path.join(self.data_dir, 'embeddings.jsonl')
    
    def load_documents(self) -> List[Dict[str, Any]]:
        """Load all documentation files"""
        documents = []
        
        # Load docs
        if os.path.exists(self.docs_dir):
            for filename in os.listdir(self.docs_dir):
                if filename.endswith(('.md', '.txt')):
                    filepath = os.path.join(self.docs_dir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        documents.append({
                            'id': self._generate_id(filename),
                            'text': content,
                            'metadata': {
                                'type': 'doc',
                                'source': 'cloudflare_docs',
                                'title': filename.replace('.md', '').replace('.txt', '').replace('_', ' ').title(),
                                'filename': filename,
                            }
                        })
        
        # Load runbooks
        if os.path.exists(self.runbooks_dir):
            for filename in os.listdir(self.runbooks_dir):
                if filename.endswith(('.md', '.txt', '.json')):
                    filepath = os.path.join(self.runbooks_dir, filename)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        if filename.endswith('.json'):
                            data = json.load(f)
                            content = data.get('content', '')
                            metadata = data.get('metadata', {})
                        else:
                            content = f.read()
                            metadata = {}
                        
                        documents.append({
                            'id': self._generate_id(filename),
                            'text': content,
                            'metadata': {
                                'type': 'runbook',
                                'source': 'security_playbooks',
                                'title': filename.replace('.md', '').replace('.txt', '').replace('.json', '').replace('_', ' ').title(),
                                'filename': filename,
                                **metadata,
                            }
                        })
        
        return documents
    
    def _generate_id(self, filename: str) -> str:
        """Generate unique ID for document"""
        return hashlib.md5(filename.encode()).hexdigest()
    
    def chunk_document(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split document into chunks for better retrieval"""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        
        return chunks
    
    def generate(self, chunk_docs: bool = True):
        """Generate embeddings data file"""
        documents = self.load_documents()
        output_data = []
        
        for doc in documents:
            if chunk_docs and len(doc['text']) > 1000:
                # Split large documents into chunks
                chunks = self.chunk_document(doc['text'])
                for i, chunk in enumerate(chunks):
                    output_data.append({
                        'id': f"{doc['id']}_chunk_{i}",
                        'text': chunk,
                        'metadata': {
                            **doc['metadata'],
                            'chunk_index': i,
                            'total_chunks': len(chunks),
                        }
                    })
            else:
                output_data.append(doc)
        
        # Write to JSONL
        with open(self.output_file, 'w', encoding='utf-8') as f:
            for item in output_data:
                f.write(json.dumps(item) + '\n')
        
        print(f"Generated {len(output_data)} embedding entries from {len(documents)} documents")
        print(f"Output saved to: {self.output_file}")
        
        return output_data


def main():
    """Main entry point"""
    generator = EmbeddingGenerator()
    generator.generate()


if __name__ == '__main__':
    main()
