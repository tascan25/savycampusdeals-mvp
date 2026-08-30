import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

const NetworkContext = createContext<NetworkStatus>({
  isConnected: true,
  isInternetReachable: true,
});

function toStatus(state: NetInfoState): NetworkStatus {
  return {
    isConnected: Boolean(state.isConnected),
    isInternetReachable: state.isInternetReachable,
  };
}

export function NetworkProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setStatus(toStatus(state)));
    NetInfo.fetch().then((state) => setStatus(toStatus(state)));
    return unsubscribe;
  }, []);

  return <NetworkContext.Provider value={status}>{children}</NetworkContext.Provider>;
}

/** Read-only network status — do not gate general offer browsing on this. */
export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkContext);
}
