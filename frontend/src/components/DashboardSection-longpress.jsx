import { useRef, useState } from "react";
import { Box, Typography, IconButton, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Link } from "react-router-dom";
import { tokens } from "../theme";

const SWIPE_THRESHOLD = 90;
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
const isTouchDevice =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/**
 * One row's interaction shell: no visible edit/delete icons by default.
 * - Desktop: hover reveals a small delete "x"; double-click opens the
 *   section's edit form (via onEditRequest).
 * - Touch: swipe-left past the threshold deletes; a long-press (that
 *   doesn't turn into a swipe) opens the edit form.
 */
const SectionItemRow = ({ item, colors, isLast, onEditRequest, onDeleteRequest, children }) => {
  const [dragX, setDragX] = useState(0);
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const onTouchStart = (e) => {
    dragging.current = true;
    longPressFired.current = false;
    startX.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      dragging.current = false;
      setDragX(0);
      if (navigator.vibrate) navigator.vibrate(15);
      onEditRequest(item);
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const x = e.touches[0].clientX - startX.current;
    if (Math.abs(x) > MOVE_CANCEL_PX) clearLongPress();
    setDragX(x);
  };

  const onTouchEnd = () => {
    clearLongPress();
    if (!dragging.current) return;
    dragging.current = false;
    if (!longPressFired.current && dragX < -SWIPE_THRESHOLD) {
      onDeleteRequest(item);
    }
    setDragX(0);
  };

  const onTouchCancel = () => {
    clearLongPress();
    dragging.current = false;
    setDragX(0);
  };

  const touchHandlers = isTouchDevice
    ? { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
    : {};

  const desktopHandlers = isTouchDevice
    ? {}
    : {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onDoubleClick: () => onEditRequest(item),
      };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "6px",
        borderBottom: isLast ? "none" : `1px solid ${colors.primary[500]}`,
      }}
    >
      {isTouchDevice && dragX < 0 && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            pr: 3,
            backgroundColor: colors.redAccent[500],
            opacity: Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1),
          }}
        >
          <CloseIcon sx={{ color: "#fff" }} />
        </Box>
      )}

      <Box
        {...touchHandlers}
        {...desktopHandlers}
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "10px",
          py: "10px",
          px: isTouchDevice ? 0 : "2px",
          backgroundColor: colors.primary[400],
          transform: isTouchDevice ? `translateX(${dragX}px)` : "none",
          transition: dragging.current ? "none" : "transform 0.2s ease",
          cursor: isTouchDevice ? "grab" : "default",
          userSelect: "none",
        }}
      >
        {children}

        {!isTouchDevice && hovered && (
          <IconButton
            size="small"
            aria-label="Delete"
            onClick={() => onDeleteRequest(item)}
            sx={{
              position: "absolute",
              right: -6,
              top: -6,
              backgroundColor: colors.primary[500],
              "&:hover": { backgroundColor: colors.redAccent[700] },
            }}
          >
            <CloseIcon fontSize="small" sx={{ color: colors.redAccent[400] }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
};

/**
 * A single dashboard panel: header (icon + title + optional "View all" link)
 * followed by a vertical list of items, or an empty-state message
 * when there's nothing to show.
 *
 * Each item is expected to look like:
 *   { id, primary, secondary?, meta?, raw? }
 * - primary: main line of text (e.g. "Mom's Birthday")
 * - secondary: smaller supporting text under primary (e.g. "Birthday")
 * - meta: right-aligned text, usually a date/amount (e.g. "Aug 12")
 * - raw: the untransformed DB row, used to prefill the edit form
 *
 * Edit/delete are triggered by interaction, not visible icons:
 * double-click + hover-x on desktop, long-press + swipe-left on touch.
 * Pass onEditRequest/onDeleteRequest to enable them; omit either to leave
 * that action off for a given section.
 *
 * Pass a custom `renderItem(item, index)` if a section needs a different
 * row layout than the default (edit/delete gestures won't apply to it).
 */
const DashboardSection = ({
  title,
  icon,
  items = [],
  emptyMessage = "Nothing here yet",
  viewAllLink,
  renderItem,
  onEditRequest,
  onDeleteRequest,
}) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);

  const defaultRenderItem = (item, i) => {
    const row = (
      <>
        <Box
          minWidth={0}
          sx={{
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          <Typography
            color={colors.grey[100]}
            fontWeight="600"
            title={item.primary}
            sx={{
              fontSize: { xs: "1.25rem", sm: "0.875rem" },
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {item.primary}
          </Typography>
          {item.secondary && (
            <Typography
              variant="body2"
              color={colors.grey[300]}
              sx={{
                fontSize: { xs: "0.9rem", sm: "0.75rem" },
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {item.secondary}
            </Typography>
          )}
        </Box>
        {item.meta && (
          <Typography
            variant="body2"
            color={colors.greenAccent[500]}
            whiteSpace="nowrap"
            sx={{ flexShrink: 0, fontSize: { xs: "0.9rem", sm: "0.75rem" } }}
          >
            {item.meta}
          </Typography>
        )}
      </>
    );

    if (!onEditRequest && !onDeleteRequest) {
      // No handlers wired up (e.g. a section not yet edit/delete-enabled)
      // — render the plain row, same as before.
      return (
        <Box
          key={item.id ?? i}
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          borderBottom={i === items.length - 1 ? "none" : `1px solid ${colors.primary[500]}`}
          py="10px"
          gap="10px"
        >
          {row}
        </Box>
      );
    }

    return (
      <SectionItemRow
        key={item.id ?? i}
        item={item}
        colors={colors}
        isLast={i === items.length - 1}
        onEditRequest={onEditRequest || (() => {})}
        onDeleteRequest={onDeleteRequest || (() => {})}
      >
        {row}
      </SectionItemRow>
    );
  };

  return (
    <Box
      backgroundColor={colors.primary[400]}
      borderRadius="16px"
      p="20px"
      display="flex"
      flexDirection="column"
      height="100%"
      sx={{
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="10px"
        pb="10px"
        borderBottom={`3px solid ${colors.primary[500]}`}
      >
        <Box display="flex" alignItems="center" gap="10px" minWidth={0}>
          <Box
            color={colors.greenAccent[500]}
            display="flex"
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {icon}
          </Box>
          <Typography
            variant="h5"
            fontWeight="600"
            color={colors.grey[100]}
            sx={{
              wordBreak: "break-word",
            }}
          >
            {title}
          </Typography>
        </Box>
        {viewAllLink && (
          <Typography
            component={Link}
            to={viewAllLink}
            variant="body2"
            sx={{
              color: colors.greenAccent[400],
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
              ml: "10px",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View all
          </Typography>
        )}
      </Box>

      {/* BODY */}
      <Box flex={1} overflow="auto">
        {items.length === 0 ? (
          <Box
            height="100%"
            minHeight="80px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography color={colors.grey[300]} fontStyle="italic">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
          items.map((item, i) =>
            renderItem ? renderItem(item, i) : defaultRenderItem(item, i)
          )
        )}
      </Box>
    </Box>
  );
};

export default DashboardSection;
