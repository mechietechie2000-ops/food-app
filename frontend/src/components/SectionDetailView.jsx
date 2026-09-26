import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../theme";
import Header from "./Header";
import SectionForm from "./SectionForm";
import sectionFields from "../config/sectionFields";
import { listRecords, insertRecord, updateRecord, deleteRecord } from "../data/sectionRepository";

// Generic "View all" page for any section that has a viewAllLink. Unlike
// scenes/routine/RoutineAdmin.jsx (a one-off table hand-built for the
// routine table's own columns/endpoint), this reads its column list and
// its endpoint from config/sectionFields.js + data/sectionRepository.js,
// so any current or future section gets a working detail view for free
// just by adding `detailFields` to its sectionFields entry — nothing here
// is specific to Todo Task.
//
// Column set shown = fields (quick-add) + detailFields (extra columns),
// in that order, deduped by name.
const getDetailColumns = (config) => {
  const seen = new Set();
  const cols = [];
  for (const field of [...(config.fields || []), ...(config.detailFields || [])]) {
    if (seen.has(field.name)) continue;
    seen.add(field.name);
    cols.push(field);
  }
  return cols;
};

const formatCellValue = (field, row) => {
  const value = row[field.name];
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "select") {
    const opts = typeof field.options === "function" ? field.options(row) : field.options || [];
    const match = opts.find((o) => String((typeof o === "object" ? o.value : o)) === String(value));
    return match ? (typeof match === "object" ? match.label : match) : value;
  }
  if (field.name === "family_member_id") return row.family_member_name || value;
  return String(value);
};

const SectionDetailView = ({ sectionKey }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const config = sectionFields[sectionKey];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // raw row, or null when adding

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listRecords(sectionKey);
      setItems(rows);
    } catch (err) {
      console.error(`Failed to load ${sectionKey}:`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (!config) {
    return (
      <Box m="20px">
        <Typography color={colors.grey[100]}>Unknown section "{sectionKey}".</Typography>
      </Box>
    );
  }

  const columns = getDetailColumns(config);

  const openAdd = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item.raw);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (key, values) => {
    if (editingItem) {
      await updateRecord(key, editingItem.id, values);
    } else {
      await insertRecord(key, values);
    }
    await load();
    closeDialog();
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.primary || "this item"}"?`)) return;
    try {
      await deleteRecord(sectionKey, item.id);
      await load();
    } catch (err) {
      console.error(`Failed to delete ${sectionKey} item ${item.id}:`, err);
    }
  };

  return (
    <Box m={{ xs: "0px", sm: "20px" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb="20px">
        <Header title={config.label.toUpperCase()} subtitle={`All ${config.label.toLowerCase()} records`} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          sx={{
            backgroundColor: colors.blueAccent[600],
            color: "#fff",
            fontWeight: "bold",
            "&:hover": { backgroundColor: colors.blueAccent[700] },
            height: "fit-content",
          }}
        >
          Add
        </Button>
      </Box>

      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: colors.primary[400],
          backgroundImage: "none",
          borderRadius: "10px",
          boxShadow: "none",
        }}
      >
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ backgroundColor: colors.blueAccent[700] }}>
            <TableRow>
              {columns.map((field) => (
                <TableCell key={field.name} sx={{ color: colors.grey[100], fontWeight: "bold" }}>
                  {field.label}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ color: colors.grey[100], fontWeight: "bold" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                sx={{ "&:last-child td, &:last-child th": { border: 0 }, borderColor: colors.primary[500] }}
              >
                {columns.map((field) => (
                  <TableCell key={field.name} sx={{ color: colors.grey[200] }}>
                    {formatCellValue(field, item.raw)}
                  </TableCell>
                ))}
                <TableCell align="right">
                  <IconButton onClick={() => openEdit(item)} title="Edit" size="small">
                    <EditIcon fontSize="small" sx={{ color: colors.blueAccent[400] }} />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(item)} title="Delete" size="small">
                    <DeleteIcon fontSize="small" sx={{ color: colors.redAccent[400] }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ color: colors.grey[300], py: 4 }}>
                  {config.emptyMessage || "Nothing here yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { backgroundColor: colors.primary[400], color: colors.grey[100], backgroundImage: "none", borderRadius: "10px" },
        }}
      >
        <DialogTitle variant="h3" fontWeight="bold" sx={{ color: colors.grey[100] }}>
          {editingItem ? `Edit ${config.label}` : `Add ${config.label}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <SectionForm
            sectionKey={sectionKey}
            initialValues={editingItem}
            fieldsOverride={columns}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SectionDetailView;
