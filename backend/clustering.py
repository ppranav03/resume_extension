import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

MIN_JOBS = 3
MAX_K = 8


def _kmeans(X, k):
    return KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(X)


def cluster(vectors, k=None):
    """Cluster embedding vectors with KMeans and project them to 2D for plotting.

    k=None picks the cluster count with the best silhouette score.
    Returns (labels, coords, k) where labels[i] is the cluster id of vectors[i],
    numbered by size (0 is the largest), and coords is an (n, 2) array.
    """
    X = np.array(vectors, dtype=float)
    X /= np.linalg.norm(X, axis=1, keepdims=True).clip(min=1e-12)
    n = len(X)

    if k is None:
        best_score, labels = -2.0, None
        for candidate in range(2, min(MAX_K, n - 1) + 1):
            candidate_labels = _kmeans(X, candidate)
            if len(set(candidate_labels)) < 2:
                continue
            score = silhouette_score(X, candidate_labels)
            if score > best_score:
                best_score, labels = score, candidate_labels
        if labels is None:
            labels = np.zeros(n, dtype=int)
    else:
        labels = _kmeans(X, min(k, n))

    labels = _renumber_by_size(labels)
    coords = PCA(n_components=2, random_state=0).fit_transform(X)
    return labels, coords, len(set(labels))


def _renumber_by_size(labels):
    """Relabel clusters so 0 is the largest, so cluster ids (and colors) are stable."""
    ids, counts = np.unique(labels, return_counts=True)
    order = sorted(zip(ids, counts), key=lambda pair: (-pair[1], pair[0]))
    mapping = {old: new for new, (old, _) in enumerate(order)}
    return np.array([mapping[label] for label in labels])
