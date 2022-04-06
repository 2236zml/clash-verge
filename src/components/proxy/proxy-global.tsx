import useSWR, { useSWRConfig } from "swr";
import { useEffect, useRef, useState } from "react";
import { useLockFn } from "ahooks";
import { Virtuoso } from "react-virtuoso";
import { Box, IconButton, TextField } from "@mui/material";
import {
  MyLocationRounded,
  NetworkCheckRounded,
  FilterAltRounded,
  FilterAltOffRounded,
  VisibilityRounded,
  VisibilityOffRounded,
} from "@mui/icons-material";
import { ApiType } from "../../services/types";
import { updateProxy } from "../../services/api";
import { getProfiles, patchProfile } from "../../services/cmds";
import delayManager from "../../services/delay";
import useFilterProxy from "./use-filter-proxy";
import ProxyItem from "./proxy-item";

interface Props {
  groupName: string;
  curProxy?: string;
  proxies: ApiType.ProxyItem[];
}

// this component will be used for DIRECT/GLOBAL
const ProxyGlobal = (props: Props) => {
  const { groupName, curProxy, proxies } = props;

  const { mutate } = useSWRConfig();
  const [now, setNow] = useState(curProxy || "DIRECT");
  const [showType, setShowType] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterText, setFilterText] = useState("");

  const virtuosoRef = useRef<any>();
  const filterProxies = useFilterProxy(proxies, groupName, filterText);

  const { data: profiles } = useSWR("getProfiles", getProfiles);

  const onChangeProxy = useLockFn(async (name: string) => {
    await updateProxy(groupName, name);
    setNow(name);

    if (groupName === "DIRECT") return;

    // update global selected
    const profile = profiles?.items?.find((p) => p.uid === profiles.current);
    if (!profile) return;
    if (!profile.selected) profile.selected = [];

    const index = profile.selected.findIndex((item) => item.name === groupName);
    if (index < 0) {
      profile.selected.unshift({ name: groupName, now: name });
    } else {
      profile.selected[index] = { name: groupName, now: name };
    }

    await patchProfile(profiles!.current!, { selected: profile.selected });
  });

  const onLocation = (smooth = true) => {
    const index = filterProxies.findIndex((p) => p.name === now);

    if (index >= 0) {
      virtuosoRef.current?.scrollToIndex?.({
        index,
        align: "center",
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  const onCheckAll = useLockFn(async () => {
    const names = filterProxies.map((p) => p.name);

    await delayManager.checkListDelay(
      { names, groupName, skipNum: 8, maxTimeout: 600 },
      () => mutate("getProxies")
    );

    mutate("getProxies");
  });

  useEffect(() => onLocation(false), [groupName]);

  useEffect(() => {
    if (!showFilter) setFilterText("");
  }, [showFilter]);

  useEffect(() => {
    if (groupName === "DIRECT") setNow("DIRECT");
    else if (groupName === "GLOBAL") {
      if (profiles) {
        const current = profiles.current;
        const profile = profiles.items?.find((p) => p.uid === current);

        profile?.selected?.forEach((item) => {
          if (item.name === "GLOBAL") {
            if (item.now && item.now !== curProxy) {
              updateProxy("GLOBAL", item.now).then(() => setNow(item!.now!));
              mutate("getProxies");
            }
          }
        });
      }

      setNow(curProxy || "DIRECT");
    }
  }, [groupName, curProxy, profiles]);

  return (
    <>
      <Box
        sx={{
          px: 3,
          my: 0.5,
          display: "flex",
          alignItems: "center",
          button: { mr: 0.5 },
        }}
      >
        <IconButton
          size="small"
          title="location"
          color="inherit"
          onClick={() => onLocation(true)}
        >
          <MyLocationRounded />
        </IconButton>

        <IconButton
          size="small"
          title="delay check"
          color="inherit"
          onClick={onCheckAll}
        >
          <NetworkCheckRounded />
        </IconButton>

        <IconButton
          size="small"
          title="proxy detail"
          color="inherit"
          onClick={() => setShowType(!showType)}
        >
          {showType ? <VisibilityRounded /> : <VisibilityOffRounded />}
        </IconButton>

        <IconButton
          size="small"
          title="filter"
          color="inherit"
          onClick={() => setShowFilter(!showFilter)}
        >
          {showFilter ? <FilterAltRounded /> : <FilterAltOffRounded />}
        </IconButton>

        {showFilter && (
          <TextField
            autoFocus
            hiddenLabel
            value={filterText}
            size="small"
            variant="outlined"
            placeholder="Filter conditions"
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ ml: 0.5, flex: "1 1 auto", input: { py: 0.65, px: 1 } }}
          />
        )}
      </Box>

      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "calc(100% - 40px)" }}
        totalCount={filterProxies.length}
        itemContent={(index) => (
          <ProxyItem
            groupName={groupName}
            proxy={filterProxies[index]}
            selected={filterProxies[index].name === now}
            showType={showType}
            onClick={onChangeProxy}
            sx={{ py: 0, px: 2 }}
          />
        )}
      />
    </>
  );
};

export default ProxyGlobal;
