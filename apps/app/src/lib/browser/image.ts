export const getBase64ImageUrl = (base64String: string) => {
  if (!base64String) return '';
  if (base64String.startsWith('data:image')) {
    return base64String;
  }
  return `data:image/png;base64,${base64String}`;
};

export const getImageUrl = (path: string) => {
  if (path.includes('/')) {
    const searchParams = new URLSearchParams();
    searchParams.set('path', path);
    return `/api/workspace?${searchParams.toString()}`;
  }
  return getBase64ImageUrl(path);
};
