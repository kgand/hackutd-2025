

export interface Article {
  article_id: number;
  title: string;
  text: string;
  article_summary: string;
  source: string;
  cluster_id: number;
}

export interface Cluster {
  cluster_id: number;
  cluster_summary: string;
  cluster_title: string;
}

export interface GraphData {
  articles: Article[];
  clusters: Cluster[];
}

const SENTIMENT_API_ENDPOINT = 'http://localhost:3000/api/sentiment/all';


export async function transformCacheDataToGraphView(): Promise<GraphData> {
  return transformServerDataToGraphView();
}


export async function transformServerDataToGraphView(): Promise<GraphData> {
  try {

    const apiResponse = await fetch(SENTIMENT_API_ENDPOINT);

    if (!apiResponse.ok) {
      throw new Error(`Failed to fetch sentiment data: ${apiResponse.status}`);
    }

    const serverData = await apiResponse.json();

    return {
      articles: serverData.articles || [],
      clusters: serverData.clusters || []
    };
  } catch (fetchError) {
    console.error('Error fetching T-Mobile sentiment data:', fetchError);
    return { articles: [], clusters: [] };
  }
}
