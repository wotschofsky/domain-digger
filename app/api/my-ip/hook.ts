import useSWRImmutable from 'swr/immutable';

type MyIpResponse = {
  ip: string;
};

export const useMyIp = () => {
  const { data } = useSWRImmutable<MyIpResponse>('/api/my-ip');
  return data?.ip;
};
