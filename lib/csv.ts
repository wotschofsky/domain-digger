export const generateCsv = <T extends Record<string, any>>(data: T[]) => {
  if (!data.length) return '';
  const columns = Object.keys(data[0]);
  const header = columns.join(',');
  const rows = data.map((row) =>
    columns.map((column) => row[column]).join(','),
  );
  return [header, ...rows].join('\n');
};
