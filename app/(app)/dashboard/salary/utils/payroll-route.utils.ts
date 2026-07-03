type SearchParamsLike = {
  get: (key: string) => string | null;
  toString: () => string;
};

export function getPayrollRoutePeriod(searchParams: SearchParamsLike) {
  const now = new Date();
  const parsedMonth = Number(searchParams.get('month'));
  const parsedYear = Number(searchParams.get('year'));

  return {
    month:
      Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : now.getMonth() + 1,
    year: Number.isInteger(parsedYear) && parsedYear >= 2000 ? parsedYear : now.getFullYear(),
  };
}

export function buildPayrollRouteHref(
  pathname: string,
  searchParams: SearchParamsLike,
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(searchParams.toString());

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
