// src/lib/api.ts

import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface Oscar {
  originalCategory: string;
  fullCategory: string;
  isWin: boolean;
}

export interface MovieData {
  imdb: {
    title: string;
    rating: string;
    image: string;
    url: string;
  };
  rottenTomatoes: {
    title: string;
    criticScore: string;
    audienceScore: string;
    genres: string[];
    releaseDate: string;
    image: string;
    url: string;
  };
  oscars: Oscar[];
  genres: string[];
}

/**
 * Fetch movie details (public search). If `token` is provided,
 * will include it in the Authorization header, otherwise
 * makes an unauthenticated request.
 */
export const fetchMovies = async (
  title: string,
  token?: string,
): Promise<MovieData> => {
  console.log(`📤 Sending request to /api/movies with title: ${title}`);
  console.log(`🌐 API_BASE_URL: ${API_BASE_URL}`);
  console.log(`🔑 Using token: ${token ?? "none"}`);

  // Build headers only if token exists
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await axios.get<MovieData>(`${API_BASE_URL}/api/movies`, {
    params: { title },
    headers,
  });

  console.log("🎥 Movie data fetched:", response.data);

  // Normalize oscars shape just in case
  return {
    ...response.data,
    oscars: response.data.oscars.map((o) => ({
      originalCategory: o.originalCategory,
      fullCategory: o.fullCategory,
      isWin: o.isWin,
    })),
  };
};

export interface DecisionResponse {
  movieData?: MovieData;
  decision?: string;
  explanation?: string;
  aiUnavailable?: boolean;
  message?: string;
}

/**
 * Fetch AI decision on whether to watch (requires token).
 */
export const fetchMovieDecision = async (
  title: string,
  token: string,
): Promise<DecisionResponse> => {
  console.log(
    `📤 Sending request to /api/movies/decision with title: ${title}`,
  );
  console.log(`🔑 Using token: ${token}`);

  try {
    const response = await axios.get<{
      movieData: MovieData;
      decision: { decision: string; explanation?: string };
      aiUnavailable?: boolean;
      message?: string;
    }>(`${API_BASE_URL}/api/movies/decision`, {
      params: { movie: title },
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("📥 Received response from /api/movies/decision:", response.data);

    // If AI unavailable, propagate that up
    if (response.data.aiUnavailable) {
      return {
        aiUnavailable: true,
        message: response.data.message,
      };
    }

    const { movieData, decision } = response.data;
    return {
      movieData: {
        ...movieData,
        oscars: movieData.oscars.map((o) => ({
          originalCategory: o.originalCategory,
          fullCategory: o.fullCategory,
          isWin: o.isWin,
        })),
      },
      decision: decision.decision,
      explanation: decision.explanation ?? "No explanation provided.",
    };
  } catch (err: unknown) {
    // Type guard for AxiosError
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: unknown }).response === "object" &&
      (err as { response?: { data?: unknown } }).response !== null &&
      "data" in (err as { response: { data?: unknown } }).response!
    ) {
      const data = (err as { response: { data?: unknown } }).response.data as Record<string, unknown>;
      if (data && data.aiUnavailable) {
        return {
          aiUnavailable: true,
          message: typeof data.message === "string" ? data.message : undefined,
        };
      }
    }
    throw err;
  }
};
