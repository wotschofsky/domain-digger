const REACT_ERROR_CATEGORIES: Partial<Record<string, string>> = {
  '412': 'connection_closed',
  '441': 'server_render',
};

export const getBoundaryErrorContext = (error: Error & { digest?: string }) => {
  const reactErrorCode = /Minified React error #(\d+)/.exec(error.message)?.[1];

  return {
    message: 'boundary_error',
    name: error.name,
    error: error.message,
    digest: error.digest,
    stack: error.stack,
    page: typeof window === 'undefined' ? undefined : window.location.pathname,
    browserCommit: process.env.NEXT_PUBLIC_DEPLOYMENT_COMMIT,
    browserDeploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID,
    reactErrorCode,
    category:
      (reactErrorCode && REACT_ERROR_CATEGORIES[reactErrorCode]) ??
      'application',
  };
};
