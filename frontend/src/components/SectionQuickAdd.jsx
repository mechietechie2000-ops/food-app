import { Box, Paper, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../theme";
import Header from "./Header";
import SectionForm from "./SectionForm";
import sectionFields from "../config/sectionFields";
import { insertRecord } from "../data/sectionRepository";

// Standalone page version of the quick-add modal shown on the dashboard
// card ("+" icon) — same SectionForm, same fields, just reachable at its
// own URL (e.g. /todo-task/new) for deep-linking. Works for any
// sectionKey, not just Todo Task.
const SectionQuickAdd = ({ sectionKey, redirectTo }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const navigate = useNavigate();
  const config = sectionFields[sectionKey];

  if (!config) return null;

  const handleSubmit = async (key, values) => {
    await insertRecord(key, values);
    navigate(redirectTo || "/");
  };

  return (
    <Box m={{ xs: "0px", sm: "20px" }} maxWidth="480px">
      <Header title={`ADD ${config.label.toUpperCase()}`} subtitle={config.emptyMessage ? "" : ""} />
      <Paper sx={{ backgroundColor: colors.primary[400], backgroundImage: "none", borderRadius: "16px", p: "24px" }}>
        <SectionForm sectionKey={sectionKey} onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
      </Paper>
    </Box>
  );
};

export default SectionQuickAdd;
