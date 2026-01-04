import useSWRImmutable from 'swr/immutable';

type UserIpResponse = {
  ip: string;
};

export const useUserIp = () => {
  const { data } = useSWRImmutable<UserIpResponse>('/api/user-ip');
  return data?.ip;
};
