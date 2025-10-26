/**
 * RAG (Retrieval Augmented Generation) Module
 * Handles Vectorize integration for documentation search
 */

export async function getRagContext(
  vectorize: any,
  ai: any,
  query: string,
  topK: number = 3
): Promise<string[]> {
  try {
    // Skip if Vectorize is not available (local dev limitation)
    if (!vectorize || !vectorize.query) {
      console.warn('Vectorize not available in local dev mode');
      return [];
    }

    // Generate embedding for the user's query
    const embedding = await generateEmbedding(ai, query);
    
    if (!embedding) {
      return [];
    }

    // Query Vectorize index
    const results = await vectorize.query(embedding, {
      topK,
      returnMetadata: true,
      returnValues: false,
    });

    if (!results || !results.matches || results.matches.length === 0) {
      return [];
    }

    // Extract relevant text from results
    const context = results.matches
      .filter((match: any) => match.score > 0.7) // Only high-confidence matches
      .map((match: any) => {
        const metadata = match.metadata || {};
        return `[${metadata.source || 'Documentation'}] ${metadata.title || 'Untitled'}\n${match.vector?.text || metadata.content || ''}`;
      });

    return context;

  } catch (error) {
    console.error('RAG context retrieval error:', error);
    return [];
  }
}

export async function generateEmbedding(
  ai: any,
  text: string
): Promise<number[] | null> {
  try {
    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text],
    });

    if (response && response.data && response.data[0]) {
      return response.data[0];
    }

    return null;

  } catch (error) {
    console.error('Embedding generation error:', error);
    return null;
  }
}

export async function indexDocument(
  vectorize: any,
  ai: any,
  document: {
    id: string;
    text: string;
    metadata: Record<string, any>;
  }
): Promise<boolean> {
  try {
    const embedding = await generateEmbedding(ai, document.text);
    
    if (!embedding) {
      return false;
    }

    await vectorize.insert([
      {
        id: document.id,
        values: embedding,
        metadata: document.metadata,
      },
    ]);

    return true;

  } catch (error) {
    console.error('Document indexing error:', error);
    return false;
  }
}

export async function indexMultipleDocuments(
  vectorize: any,
  ai: any,
  documents: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
  }>
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  for (const doc of documents) {
    const indexed = await indexDocument(vectorize, ai, doc);
    if (indexed) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  return results;
}
