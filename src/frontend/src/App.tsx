import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  FilePlus,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Piece, Sheet } from "./backend.d";
import {
  useLocalCreateProject,
  useLocalDeleteProject,
  useLocalGetAllProjects,
  useLocalUpdateProject,
} from "./hooks/useLocalProjects";
import { optimize } from "./utils/cutlistOptimizer";
import type {
  CutPiece,
  OptimizationResult,
  StockSheet,
} from "./utils/cutlistOptimizer";

const qc = new QueryClient();

// Piece colors for SVG (raw literals since SVG can't use CSS vars)
const PIECE_COLORS = [
  { fill: "#5B8A6B", stroke: "#3d6b50", text: "#e8f5ec" },
  { fill: "#7B6EA8", stroke: "#5a4e8a", text: "#f0edf8" },
  { fill: "#C4774D", stroke: "#a35830", text: "#fdf0e8" },
  { fill: "#4A8BA8", stroke: "#2e6a88", text: "#e8f4f8" },
  { fill: "#A87B4A", stroke: "#885b2e", text: "#f8f0e8" },
  { fill: "#7BA850", stroke: "#5b8830", text: "#eef8e8" },
  { fill: "#A84A6B", stroke: "#882e50", text: "#f8e8ee" },
  { fill: "#4A7BA8", stroke: "#2e5b88", text: "#e8eef8" },
  { fill: "#8BA84A", stroke: "#6b882e", text: "#f4f8e8" },
  { fill: "#A84A4A", stroke: "#882e2e", text: "#f8e8e8" },
  { fill: "#4AA8A8", stroke: "#2e8888", text: "#e8f8f8" },
  { fill: "#8A6B5B", stroke: "#6b4d3d", text: "#f5ede8" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

type Unit = "mm" | "in";

type EditDraft = {
  label: string;
  width: string;
  height: string;
  quantity: string;
  laminateFront: string;
  laminateBack: string;
  stockSheetId: string;
};

function SheetDiagram({
  sheet,
  unit,
}: { sheet: OptimizationResult["sheets"][0]; unit: Unit }) {
  const maxW = 600;
  const maxH = 400;
  const scaleX = maxW / sheet.sheetWidth;
  const scaleY = maxH / sheet.sheetHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  const svgW = sheet.sheetWidth * scale;
  const svgH = sheet.sheetHeight * scale;
  const unitLabel = unit === "mm" ? "mm" : "in";

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredPiece =
    hoveredIdx !== null ? sheet.placedPieces[hoveredIdx] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold text-foreground text-sm">
          Sheet {sheet.sheetIndex + 1} — {sheet.sheetLabel}
          {(sheet.laminateFront || sheet.laminateBack) && (
            <span className="font-normal text-muted-foreground">
              {" "}
              [F: {sheet.laminateFront || "—"} / B: {sheet.laminateBack || "—"}]
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-mono text-xs text-muted-foreground">
            {sheet.sheetWidth} × {sheet.sheetHeight} {unitLabel}
          </span>
          <Badge variant="outline" className="text-xs font-mono">
            {sheet.utilization.toFixed(1)}% used
          </Badge>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative rounded-md overflow-visible border border-border"
        style={{ width: svgW, height: svgH }}
      >
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
          role="img"
          aria-label={`Sheet layout for ${sheet.sheetLabel}`}
          style={{ display: "block", borderRadius: "6px", overflow: "hidden" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Sheet background */}
          <rect
            x={0}
            y={0}
            width={sheet.sheetWidth}
            height={sheet.sheetHeight}
            fill="#1a1c2e"
          />

          {/* Waste / free rects */}
          {sheet.freeRects.map((fr) => (
            <rect
              key={`fr-${fr.x}-${fr.y}`}
              x={fr.x}
              y={fr.y}
              width={fr.w}
              height={fr.h}
              fill="#141624"
              stroke="#252840"
              strokeWidth={0.5}
            />
          ))}

          {/* Grid lines */}
          {Array.from({ length: Math.floor(sheet.sheetWidth / 100) + 1 }).map(
            (_, i) => (
              <line
                key={`vg-${i * 100}`}
                x1={i * 100}
                y1={0}
                x2={i * 100}
                y2={sheet.sheetHeight}
                stroke="#252840"
                strokeWidth={0.3}
              />
            ),
          )}
          {Array.from({ length: Math.floor(sheet.sheetHeight / 100) + 1 }).map(
            (_, i) => (
              <line
                key={`hg-${i * 100}`}
                x1={0}
                y1={i * 100}
                x2={sheet.sheetWidth}
                y2={i * 100}
                stroke="#252840"
                strokeWidth={0.3}
              />
            ),
          )}

          {/* Placed pieces */}
          {sheet.placedPieces.map((p, idx) => {
            const colors = PIECE_COLORS[p.colorIndex % PIECE_COLORS.length];
            // Scale-aware font sizing: compute pixel size at current scale
            const pxW = p.w * scale;
            const pxH = p.h * scale;
            const showLabel = pxW > 36 && pxH > 24;
            // Target ~13px for label, ~11px for dims; convert back to SVG units
            const labelFontSize = Math.min(13 / scale, p.w * 0.45, p.h * 0.35);
            const dimFontSize = Math.min(11 / scale, p.w * 0.38, p.h * 0.28);
            const isHovered = hoveredIdx === idx;
            const cx = p.x + p.w / 2;
            const cy = p.y + p.h / 2;
            return (
              <g
                key={`pp-${p.x}-${p.y}`}
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  fill={isHovered ? colors.stroke : colors.fill}
                  stroke={isHovered ? "#f5d76a" : colors.stroke}
                  strokeWidth={isHovered ? 3 : 1}
                  rx={2}
                  style={{ filter: isHovered ? "brightness(1.3)" : "none" }}
                />
                {showLabel && (
                  <>
                    <text
                      x={cx}
                      y={cy - labelFontSize * 0.7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={labelFontSize}
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="600"
                      fill={colors.text}
                    >
                      {p.label}
                    </text>
                    <text
                      x={cx}
                      y={cy + dimFontSize * 1.1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={dimFontSize}
                      fontFamily="JetBrains Mono, monospace"
                      fill={colors.text}
                      opacity={0.8}
                    >
                      {p.w}×{p.h}
                      {p.rotated ? "↺" : ""}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Sheet border */}
          <rect
            x={0}
            y={0}
            width={sheet.sheetWidth}
            height={sheet.sheetHeight}
            fill="none"
            stroke="#c8a84a"
            strokeWidth={2}
          />
        </svg>

        {/* Hover tooltip */}
        {hoveredPiece &&
          (() => {
            const tooltipW = 170;
            const tooltipH = 68;
            const pad = 12;
            let tx = mousePos.x + pad;
            let ty = mousePos.y - tooltipH - pad;
            if (tx + tooltipW > svgW) tx = mousePos.x - tooltipW - pad;
            if (ty < 0) ty = mousePos.y + pad;
            return (
              <div
                style={{
                  position: "absolute",
                  left: tx,
                  top: ty,
                  width: tooltipW,
                  pointerEvents: "none",
                  zIndex: 50,
                }}
                className="bg-card border border-border rounded-lg shadow-lg px-3 py-2.5"
              >
                <p className="font-mono font-bold text-sm text-foreground leading-tight truncate">
                  {hoveredPiece.label}
                </p>
                <p className="font-mono text-xs text-primary mt-0.5">
                  {hoveredPiece.w} × {hoveredPiece.h} {unitLabel}
                  {hoveredPiece.rotated ? " ↺ rotated" : ""}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  at ({hoveredPiece.x}, {hoveredPiece.y})
                </p>
              </div>
            );
          })()}
      </div>
      <Progress value={sheet.utilization} className="h-1.5" />
    </div>
  );
}

// LaminateSelect: custom dropdown with "Add laminate..." inline option
function LaminateSelect({
  value,
  onChange,
  options,
  onAddOption,
  ocid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddOption: (name: string) => void;
  ocid?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setAdding(false);
        setInputVal("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const [adding, setAdding] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [adding]);

  const handleAdd = () => {
    const name = inputVal.trim();
    if (name) {
      onAddOption(name);
      onChange(name);
    }
    setAdding(false);
    setInputVal("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        data-ocid={ocid}
        onClick={() => {
          setOpen((o) => !o);
          setAdding(false);
        }}
        className="flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs text-left ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "None"}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[140px] rounded-md border bg-popover shadow-md">
          {options.length > 0 && (
            <div className="max-h-40 overflow-y-auto py-1">
              {/* Empty / None option */}
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`flex w-full items-center px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground ${!value ? "font-semibold text-primary" : "text-muted-foreground"}`}
              >
                None
              </button>
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground ${value === opt ? "font-semibold text-primary" : ""}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          {adding ? (
            <div className="flex items-center gap-1 px-2 py-1.5 border-t">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setInputVal("");
                  }
                }}
                placeholder="Laminate name..."
                className="flex-1 h-6 text-xs bg-transparent border-b border-input outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={handleAdd}
                className="text-primary hover:text-primary/80"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setInputVal("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-primary hover:bg-accent border-t"
            >
              <Plus className="w-3 h-3" /> Add laminate...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  // Unit
  const [unit, setUnit] = useState<Unit>("mm");

  // Laminate options (user-defined)
  const [laminateOptions, setLaminateOptions] = useState<string[]>([]);

  // Inline editing state — stores the id of the item being edited + its draft values
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({
    label: "",
    width: "",
    height: "",
    quantity: "1",
    laminateFront: "",
    laminateBack: "",
    stockSheetId: "",
  });

  const startEdit = useCallback((item: StockSheet | CutPiece) => {
    setEditingId(item.id);
    setEditDraft({
      label: item.label,
      width: String(item.width),
      height: String(item.height),
      quantity: String(item.quantity),
      laminateFront: (item as StockSheet).laminateFront ?? "",
      laminateBack: (item as StockSheet).laminateBack ?? "",
      stockSheetId: (item as CutPiece).stockSheetId ?? "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  // Stock sheets state
  const [stocks, setStocks] = useState<StockSheet[]>([
    {
      id: generateId(),
      label: "Plywood 2440×1220",
      width: 2440,
      height: 1220,
      quantity: 5,
    },
    {
      id: generateId(),
      label: "MDF 2400×1200",
      width: 2400,
      height: 1200,
      quantity: 3,
    },
  ]);
  const [newStock, setNewStock] = useState({
    label: "Sheet A",
    width: "",
    height: "",
    quantity: "1",
    laminateFront: "",
    laminateBack: "",
  });

  // Cut pieces state
  const [pieces, setPieces] = useState<CutPiece[]>([
    { id: generateId(), label: "Shelf", width: 800, height: 300, quantity: 4 },
    {
      id: generateId(),
      label: "Side Panel",
      width: 600,
      height: 400,
      quantity: 2,
    },
    { id: generateId(), label: "Door", width: 500, height: 700, quantity: 3 },
    {
      id: generateId(),
      label: "Back Panel",
      width: 1000,
      height: 600,
      quantity: 1,
    },
  ]);
  const [newPiece, setNewPiece] = useState({
    label: "Part",
    width: "",
    height: "",
    quantity: "1",
    stockSheetId: "",
  });

  // Optimization state
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [allowRotation, setAllowRotation] = useState(true);
  const [considerKerf, setConsiderKerf] = useState(false);
  const [kerfValue, setKerfValue] = useState("3");

  // Project management
  const [projectName, setProjectName] = useState("");
  const [showProjects, setShowProjects] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState(false);
  const [pendingProjectLoad, setPendingProjectLoad] = useState<
    (typeof projects)[0] | null
  >(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading: projectsLoading } =
    useLocalGetAllProjects();
  const createProject = useLocalCreateProject();
  const updateProject = useLocalUpdateProject();
  const deleteProject = useLocalDeleteProject();

  // Save edit for a stock sheet
  const saveStockEdit = useCallback(
    (id: string) => {
      const w = Number.parseFloat(editDraft.width);
      const h = Number.parseFloat(editDraft.height);
      const q = Number.parseInt(editDraft.quantity);
      if (
        !editDraft.label ||
        Number.isNaN(w) ||
        w <= 0 ||
        Number.isNaN(h) ||
        h <= 0
      ) {
        toast.error("Width and height must be greater than 0");
        return;
      }
      if (Number.isNaN(q) || q < 1) {
        toast.error("Quantity must be at least 1");
        return;
      }
      setStocks((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                label: editDraft.label,
                width: w,
                height: h,
                quantity: q,
                laminateFront: editDraft.laminateFront,
                laminateBack: editDraft.laminateBack,
              }
            : s,
        ),
      );
      setEditingId(null);
      toast.success("Stock sheet updated");
    },
    [editDraft],
  );

  // Save edit for a cut piece
  const savePieceEdit = useCallback(
    (id: string) => {
      const w = Number.parseFloat(editDraft.width);
      const h = Number.parseFloat(editDraft.height);
      const q = Number.parseInt(editDraft.quantity);
      if (
        !editDraft.label ||
        Number.isNaN(w) ||
        w <= 0 ||
        Number.isNaN(h) ||
        h <= 0
      ) {
        toast.error("Width and height must be greater than 0");
        return;
      }
      if (Number.isNaN(q) || q < 1) {
        toast.error("Quantity must be at least 1");
        return;
      }
      setPieces((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                label: editDraft.label,
                width: w,
                height: h,
                quantity: q,
                stockSheetId: editDraft.stockSheetId || undefined,
              }
            : p,
        ),
      );
      setEditingId(null);
      toast.success("Piece updated");
    },
    [editDraft],
  );

  // Add stock sheet
  const addStock = useCallback(() => {
    const w = Number.parseFloat(newStock.width);
    const h = Number.parseFloat(newStock.height);
    const q = Number.parseInt(newStock.quantity);
    if (
      !newStock.label ||
      Number.isNaN(w) ||
      Number.isNaN(h) ||
      w <= 0 ||
      h <= 0
    ) {
      toast.error("Please enter valid stock sheet dimensions");
      return;
    }
    setStocks((prev) => [
      ...prev,
      {
        id: generateId(),
        label: newStock.label,
        width: w,
        height: h,
        quantity: Math.max(1, q || 1),
        laminateFront: newStock.laminateFront,
        laminateBack: newStock.laminateBack,
      },
    ]);
    setNewStock({
      label: "Sheet A",
      width: "",
      height: "",
      quantity: "1",
      laminateFront: "",
      laminateBack: "",
    });
    toast.success("Stock sheet added");
  }, [newStock]);

  const removeStock = useCallback((id: string) => {
    setStocks((prev) => prev.filter((s) => s.id !== id));
    setEditingId((prev) => (prev === id ? null : prev));
  }, []);

  // Add cut piece
  const addPiece = useCallback(() => {
    const w = Number.parseFloat(newPiece.width);
    const h = Number.parseFloat(newPiece.height);
    const q = Number.parseInt(newPiece.quantity);
    if (
      !newPiece.label ||
      Number.isNaN(w) ||
      Number.isNaN(h) ||
      w <= 0 ||
      h <= 0
    ) {
      toast.error("Please enter valid piece dimensions");
      return;
    }
    setPieces((prev) => [
      ...prev,
      {
        id: generateId(),
        label: newPiece.label,
        width: w,
        height: h,
        quantity: Math.max(1, q || 1),
        stockSheetId: newPiece.stockSheetId || undefined,
      },
    ]);
    setNewPiece({
      label: "Part",
      width: "",
      height: "",
      quantity: "1",
      stockSheetId: "",
    });
    toast.success("Piece added");
  }, [newPiece]);

  const removePiece = useCallback((id: string) => {
    setPieces((prev) => prev.filter((p) => p.id !== id));
    setEditingId((prev) => (prev === id ? null : prev));
  }, []);

  // Run optimization
  const runOptimize = useCallback(() => {
    if (stocks.length === 0) {
      toast.error("Add at least one stock sheet");
      return;
    }
    if (pieces.length === 0) {
      toast.error("Add at least one cut piece");
      return;
    }
    const kerf = considerKerf ? Number.parseFloat(kerfValue) || 0 : 0;
    const res = optimize(stocks, pieces, allowRotation, kerf);
    setResult(res);
    toast.success(
      `Optimization complete — ${res.totalSheets} sheet${res.totalSheets !== 1 ? "s" : ""} used`,
    );
  }, [stocks, pieces, allowRotation, considerKerf, kerfValue]);

  // File import ref
  const importInputRef = useRef<HTMLInputElement>(null);

  // Export project as JSON
  const exportProject = useCallback(() => {
    const data = {
      version: 1,
      projectName: projectName || "cutlist-project",
      stocks,
      pieces,
      laminateOptions,
      considerKerf,
      kerfValue,
      allowRotation,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "cutlist-project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Project exported!");
  }, [
    projectName,
    stocks,
    pieces,
    laminateOptions,
    considerKerf,
    kerfValue,
    allowRotation,
  ]);

  // Import project from JSON
  const importProject = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!Array.isArray(data.stocks) || !Array.isArray(data.pieces)) {
            toast.error("Invalid project file: missing stocks or pieces");
            return;
          }
          setStocks(
            data.stocks.map((s: StockSheet) => ({ ...s, id: generateId() })),
          );
          setPieces(
            data.pieces.map((p: CutPiece) => ({ ...p, id: generateId() })),
          );
          if (data.projectName) setProjectName(data.projectName);
          if (Array.isArray(data.laminateOptions))
            setLaminateOptions(data.laminateOptions);
          if (typeof data.considerKerf === "boolean")
            setConsiderKerf(data.considerKerf);
          if (data.kerfValue) setKerfValue(data.kerfValue);
          if (typeof data.allowRotation === "boolean")
            setAllowRotation(data.allowRotation);
          setResult(null);
          setCurrentProjectId(null);
          setActiveProjectId(null);
          toast.success("Project imported!");
        } catch {
          toast.error("Failed to parse project file");
        }
      };
      reader.readAsText(file);
      // reset input so same file can be re-imported
      e.target.value = "";
    },
    [],
  );

  const downloadLayoutPDF = useCallback(() => {
    if (!result) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const pageW = 297;
    const pageH = 210;
    const margin = 12;
    const headerH = 14;
    const footerH = 52;
    const layoutAreaW = pageW - margin * 2;
    const layoutAreaH = pageH - margin * 2 - headerH - footerH;

    result.sheets.forEach((sheet, idx) => {
      if (idx > 0) doc.addPage();

      // Header
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const sheetTitle = `Sheet ${sheet.sheetIndex + 1} — ${sheet.sheetLabel}`;
      doc.text(sheetTitle, margin, margin + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const unitLabel = unit === "mm" ? "mm" : "in";
      const dimText = `${sheet.sheetWidth} × ${sheet.sheetHeight} ${unitLabel}   |   ${sheet.utilization.toFixed(1)}% used`;
      doc.text(dimText, margin, margin + 11);
      if (sheet.laminateFront || sheet.laminateBack) {
        const lamText = `Laminate: F: ${sheet.laminateFront || "—"} / B: ${sheet.laminateBack || "—"}`;
        doc.setFontSize(8);
        doc.text(lamText, pageW - margin, margin + 6, { align: "right" });
      }

      // Sheet Layout
      const layoutTop = margin + headerH;
      const scaleX = layoutAreaW / sheet.sheetWidth;
      const scaleY = layoutAreaH / sheet.sheetHeight;
      const scale = Math.min(scaleX, scaleY);
      const drawW = sheet.sheetWidth * scale;
      const drawH = sheet.sheetHeight * scale;
      const drawX = margin + (layoutAreaW - drawW) / 2;
      const drawY = layoutTop;

      doc.setFillColor(26, 28, 46);
      doc.rect(drawX, drawY, drawW, drawH, "F");

      for (const p of sheet.placedPieces) {
        const colors = PIECE_COLORS[p.colorIndex % PIECE_COLORS.length];
        const hex = colors.fill.replace("#", "");
        const r = Number.parseInt(hex.substring(0, 2), 16);
        const g = Number.parseInt(hex.substring(2, 4), 16);
        const b = Number.parseInt(hex.substring(4, 6), 16);

        const px = drawX + p.x * scale;
        const py = drawY + p.y * scale;
        const pw = p.w * scale;
        const ph = p.h * scale;

        doc.setFillColor(r, g, b);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.rect(px, py, pw, ph, "FD");

        if (pw > 8 && ph > 5) {
          doc.setFontSize(Math.min(6, (pw / p.label.length) * 1.8));
          doc.setTextColor(255, 255, 255);
          doc.text(p.label, px + pw / 2, py + ph / 2, {
            align: "center",
            baseline: "middle",
          });
          if (pw > 14 && ph > 9) {
            doc.setFontSize(Math.min(5, pw / 8));
            doc.setTextColor(220, 220, 220);
            const dimStr = `${p.w}×${p.h}`;
            doc.text(dimStr, px + pw / 2, py + ph / 2 + 3, {
              align: "center",
              baseline: "middle",
            });
          }
        }
      }

      doc.setDrawColor(80, 80, 120);
      doc.setLineWidth(0.3);
      doc.rect(drawX, drawY, drawW, drawH, "S");

      // Footer Legend
      const footerTop = pageH - margin - footerH + 4;
      doc.setDrawColor(180, 180, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, footerTop - 1, pageW - margin, footerTop - 1);

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 80);
      doc.text("Piece Legend", margin, footerTop + 4);

      const pieceMap: Record<
        string,
        {
          label: string;
          w: number;
          h: number;
          count: number;
          rotatedCount: number;
          colorIndex: number;
        }
      > = {};
      for (const p of sheet.placedPieces) {
        const key = `${p.label}__${p.colorIndex}`;
        if (!pieceMap[key]) {
          pieceMap[key] = {
            label: p.label,
            w: p.w,
            h: p.h,
            count: 0,
            rotatedCount: 0,
            colorIndex: p.colorIndex,
          };
        }
        pieceMap[key].count += 1;
        if (p.rotated) pieceMap[key].rotatedCount += 1;
      }
      const legendItems = Object.values(pieceMap);

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 120);
      doc.text("Part Name", margin + 8, footerTop + 10);
      doc.text("Width", margin + 50, footerTop + 10);
      doc.text("Height", margin + 85, footerTop + 10);
      doc.text("Qty", margin + 110, footerTop + 10);
      doc.text("Rotated", margin + 135, footerTop + 10);

      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 180, 200);
      doc.line(margin, footerTop + 12, pageW - margin, footerTop + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      const maxRows = 5;
      const colGroupW =
        (pageW - margin * 2) / Math.ceil(legendItems.length / maxRows);
      legendItems.forEach((item, i) => {
        const col = Math.floor(i / maxRows);
        const row = i % maxRows;
        const baseX = margin + col * colGroupW;
        const rowY = footerTop + 15 + row * 7;

        const hex = PIECE_COLORS[
          item.colorIndex % PIECE_COLORS.length
        ].fill.replace("#", "");
        const r = Number.parseInt(hex.substring(0, 2), 16);
        const g = Number.parseInt(hex.substring(2, 4), 16);
        const b = Number.parseInt(hex.substring(4, 6), 16);

        doc.setFillColor(r, g, b);
        doc.rect(baseX, rowY - 3, 4, 4, "F");

        doc.setTextColor(40, 40, 60);
        doc.text(item.label, baseX + 6, rowY);
        doc.text(`${item.w} ${unitLabel}`, baseX + 40, rowY);
        doc.text(`${item.h} ${unitLabel}`, baseX + 62, rowY);
        doc.text(`${item.count}`, baseX + 84, rowY);
        doc.text(
          item.rotatedCount > 0 ? `${item.rotatedCount}×` : "—",
          baseX + 96,
          rowY,
        );
      });

      doc.setTextColor(0, 0, 0);
    });

    doc.save("sheet-layouts.pdf");
  }, [result, unit]);

  // Save project — returns true on success
  const saveProject = useCallback(async (): Promise<boolean> => {
    if (!projectName.trim()) {
      toast.error("Enter a project name");
      return false;
    }
    const backendSheets = stocks.map((s) => ({
      sheetLabel: s.label,
      width: s.width,
      height: s.height,
      quantity: BigInt(s.quantity),
      laminateFront: s.laminateFront,
      laminateBack: s.laminateBack,
    }));
    const backendPieces = pieces.map((p) => ({
      description: p.label,
      width: p.width,
      height: p.height,
      quantity: BigInt(p.quantity),
      stockSheetId: p.stockSheetId,
    }));
    try {
      if (currentProjectId) {
        await updateProject.mutateAsync({
          id: currentProjectId,
          name: projectName,
          sheets: backendSheets,
          pieces: backendPieces,
          laminateOptions,
          considerKerf,
          kerfValue: kerfValue ? Number(kerfValue) : undefined,
          allowRotation,
        });
      } else {
        const newId = await createProject.mutateAsync({
          name: projectName,
          sheets: backendSheets,
          pieces: backendPieces,
          laminateOptions,
          considerKerf,
          kerfValue: kerfValue ? Number(kerfValue) : undefined,
          allowRotation,
        });
        if (newId) {
          setCurrentProjectId(newId);
        }
      }
      toast.success(`Project "${projectName}" saved!`);
      return true;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to save project";
      toast.error(`Save failed: ${msg}`);
      return false;
    }
  }, [
    projectName,
    stocks,
    pieces,
    createProject,
    updateProject,
    currentProjectId,
    laminateOptions,
    considerKerf,
    kerfValue,
    allowRotation,
  ]);

  // Load project
  const loadProject = useCallback((project: (typeof projects)[0]) => {
    setStocks(
      project.sheets.map((s) => ({
        id: generateId(),
        label: s.sheetLabel,
        width: s.width,
        height: s.height,
        quantity: Number(s.quantity),
        laminateFront: s.laminateFront,
        laminateBack: s.laminateBack,
      })),
    );
    setPieces(
      project.pieces.map((p) => ({
        id: generateId(),
        label: p.description,
        width: p.width,
        height: p.height,
        quantity: Number(p.quantity),
        stockSheetId: p.stockSheetId,
      })),
    );
    setProjectName(project.name);
    if (project.laminateOptions && project.laminateOptions.length > 0)
      setLaminateOptions(project.laminateOptions);
    if (typeof project.considerKerf === "boolean")
      setConsiderKerf(project.considerKerf);
    if (project.kerfValue !== undefined)
      setKerfValue(String(project.kerfValue));
    if (typeof project.allowRotation === "boolean")
      setAllowRotation(project.allowRotation);
    setActiveProjectId(project.id);
    setCurrentProjectId(project.id);
    setShowProjects(false);
    setResult(null);
    setEditingId(null);
    toast.success(`Loaded: ${project.name}`);
  }, []);

  const unitLabel = unit === "mm" ? "mm" : "in";

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Scissors
                className="w-4 h-4 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <div>
              <h1 className="font-display text-base font-bold text-foreground tracking-tight leading-none">
                CutList<span className="text-primary">Pro</span>
              </h1>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">
                Guillotine Bin Packing Optimizer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unit Toggle */}
            <div
              className="flex items-center bg-muted rounded-md p-0.5 border border-border"
              data-ocid="unit.toggle"
            >
              <button
                type="button"
                onClick={() => setUnit("mm")}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                  unit === "mm"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                mm
              </button>
              <button
                type="button"
                onClick={() => setUnit("in")}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                  unit === "in"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                in
              </button>
            </div>

            {/* Projects Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProjects(true)}
              className="gap-1.5 text-xs"
              data-ocid="project.load_button"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Projects
            </Button>

            {/* New Project Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hasData = stocks.length > 0 || pieces.length > 0;
                if (hasData) {
                  setShowNewProjectConfirm(true);
                } else {
                  toast.info("Workspace is already empty.");
                }
              }}
              className="gap-1.5 text-xs"
              data-ocid="project.new_button"
            >
              <FilePlus className="w-3.5 h-3.5" />
              New
            </Button>

            {/* Save Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowSaveDialog(true)}
              className="gap-1.5 text-xs"
              data-ocid="project.open_modal_button"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportProject}
              className="gap-1.5 text-xs"
              data-ocid="topbar.export_button"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>

            {/* Import Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              className="gap-1.5 text-xs"
              data-ocid="topbar.import_button"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={importProject}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Inputs */}
        <aside className="w-80 shrink-0 border-r border-border bg-sidebar flex flex-col">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 space-y-6">
              {/* Project save */}
              <section>
                <h2 className="font-display font-semibold text-sm text-foreground mb-3">
                  Save Project
                </h2>
                <div className="space-y-2">
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project name…"
                    className="h-7 text-xs"
                    data-ocid="project.input"
                  />
                  <Button
                    onClick={saveProject}
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs gap-1.5"
                    disabled={createProject.isPending}
                    data-ocid="project.save_button"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {createProject.isPending ? "Saving…" : "Save Project"}
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Stock Sheets Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-sm text-foreground">
                    Stock Sheets
                  </h2>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-mono"
                  >
                    {stocks.length}
                  </Badge>
                </div>

                {/* Stock list */}
                <div className="space-y-1.5 mb-3">
                  <AnimatePresence>
                    {stocks.map((s, idx) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-accent/40 border border-border rounded-md"
                        data-ocid={`stock.item.${idx + 1}`}
                      >
                        {editingId === s.id ? (
                          /* ── Edit mode ── */
                          <div className="p-2.5 space-y-2">
                            <Input
                              value={editDraft.label}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  label: e.target.value,
                                }))
                              }
                              placeholder="Label"
                              className="h-7 text-xs"
                            />
                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  W ({unitLabel})
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.width}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      width: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  H ({unitLabel})
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.height}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      height: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  Qty
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.quantity}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      quantity: e.target.value,
                                    }))
                                  }
                                  placeholder="1"
                                  min="1"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  Front Laminate
                                </Label>
                                <LaminateSelect
                                  value={editDraft.laminateFront}
                                  onChange={(v) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      laminateFront: v,
                                    }))
                                  }
                                  options={laminateOptions}
                                  onAddOption={(name) =>
                                    setLaminateOptions((o) =>
                                      o.includes(name) ? o : [...o, name],
                                    )
                                  }
                                  ocid={`stock.select.${idx + 1}`}
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  Back Laminate
                                </Label>
                                <LaminateSelect
                                  value={editDraft.laminateBack}
                                  onChange={(v) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      laminateBack: v,
                                    }))
                                  }
                                  options={laminateOptions}
                                  onAddOption={(name) =>
                                    setLaminateOptions((o) =>
                                      o.includes(name) ? o : [...o, name],
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs gap-1"
                                onClick={() => saveStockEdit(s.id)}
                                data-ocid={`stock.save_button.${idx + 1}`}
                              >
                                <Check className="w-3 h-3" /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs gap-1"
                                onClick={cancelEdit}
                                data-ocid={`stock.cancel_button.${idx + 1}`}
                              >
                                <X className="w-3 h-3" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Display mode ── */
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {s.label}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground">
                                {s.width}×{s.height} {unitLabel} · qty{" "}
                                {s.quantity}
                              </p>
                              {(s.laminateFront && s.laminateFront !== "") ||
                              (s.laminateBack && s.laminateBack !== "") ? (
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  F: {s.laminateFront ?? ""} · B:{" "}
                                  {s.laminateBack ?? ""}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              data-ocid={`stock.edit_button.${idx + 1}`}
                              aria-label={`Edit ${s.label}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStock(s.id)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-ocid={`stock.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {stocks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
                      No sheets added yet
                    </div>
                  )}
                </div>

                {/* Add stock form */}
                <div className="space-y-2 bg-muted/30 rounded-md p-2.5 border border-border">
                  <Input
                    value={newStock.label}
                    onChange={(e) =>
                      setNewStock((p) => ({ ...p, label: e.target.value }))
                    }
                    placeholder="Label"
                    className="h-7 text-xs"
                    data-ocid="stock.input"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        W ({unitLabel})
                      </Label>
                      <Input
                        type="number"
                        value={newStock.width}
                        onChange={(e) =>
                          setNewStock((p) => ({ ...p, width: e.target.value }))
                        }
                        placeholder="0"
                        className="h-7 text-xs font-mono"
                        data-ocid="stock.input"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        H ({unitLabel})
                      </Label>
                      <Input
                        type="number"
                        value={newStock.height}
                        onChange={(e) =>
                          setNewStock((p) => ({ ...p, height: e.target.value }))
                        }
                        placeholder="0"
                        className="h-7 text-xs font-mono"
                        data-ocid="stock.input"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        value={newStock.quantity}
                        onChange={(e) =>
                          setNewStock((p) => ({
                            ...p,
                            quantity: e.target.value,
                          }))
                        }
                        placeholder="1"
                        min="1"
                        className="h-7 text-xs font-mono"
                        data-ocid="stock.input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Front Laminate
                      </Label>
                      <LaminateSelect
                        value={newStock.laminateFront}
                        onChange={(v) =>
                          setNewStock((p) => ({ ...p, laminateFront: v }))
                        }
                        options={laminateOptions}
                        onAddOption={(name) =>
                          setLaminateOptions((o) =>
                            o.includes(name) ? o : [...o, name],
                          )
                        }
                        ocid="stock.select"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Back Laminate
                      </Label>
                      <LaminateSelect
                        value={newStock.laminateBack}
                        onChange={(v) =>
                          setNewStock((p) => ({ ...p, laminateBack: v }))
                        }
                        options={laminateOptions}
                        onAddOption={(name) =>
                          setLaminateOptions((o) =>
                            o.includes(name) ? o : [...o, name],
                          )
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={addStock}
                    size="sm"
                    className="w-full h-7 text-xs gap-1.5"
                    data-ocid="stock.add_button"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Sheet
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Cut Pieces Section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Scissors className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-sm text-foreground">
                    Cut Pieces
                  </h2>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs font-mono"
                  >
                    {pieces.length}
                  </Badge>
                </div>

                <div className="space-y-1.5 mb-3">
                  <AnimatePresence>
                    {pieces.map((p, idx) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-accent/40 border border-border rounded-md"
                        data-ocid={`pieces.item.${idx + 1}`}
                      >
                        {editingId === p.id ? (
                          /* ── Edit mode ── */
                          <div className="p-2.5 space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor:
                                    PIECE_COLORS[idx % PIECE_COLORS.length]
                                      .fill,
                                }}
                              />
                              <Input
                                value={editDraft.label}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    label: e.target.value,
                                  }))
                                }
                                placeholder="Label"
                                className="h-7 text-xs flex-1"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  W ({unitLabel})
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.width}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      width: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  H ({unitLabel})
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.height}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      height: e.target.value,
                                    }))
                                  }
                                  placeholder="0"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground">
                                  Qty
                                </Label>
                                <Input
                                  type="number"
                                  value={editDraft.quantity}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      quantity: e.target.value,
                                    }))
                                  }
                                  placeholder="1"
                                  min="1"
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">
                                Stock Sheet (optional)
                              </Label>
                              <select
                                value={editDraft.stockSheetId}
                                onChange={(e) =>
                                  setEditDraft((d) => ({
                                    ...d,
                                    stockSheetId: e.target.value,
                                  }))
                                }
                                className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="">Any sheet</option>
                                {stocks.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                    {s.laminateFront || s.laminateBack
                                      ? ` [F: ${s.laminateFront || "—"} / B: ${s.laminateBack || "—"}]`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs gap-1"
                                onClick={() => savePieceEdit(p.id)}
                                data-ocid={`pieces.save_button.${idx + 1}`}
                              >
                                <Check className="w-3 h-3" /> Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="flex-1 h-7 text-xs gap-1"
                                onClick={cancelEdit}
                                data-ocid={`pieces.cancel_button.${idx + 1}`}
                              >
                                <X className="w-3 h-3" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* ── Display mode ── */
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  PIECE_COLORS[idx % PIECE_COLORS.length].fill,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {p.label}
                              </p>
                              <p className="text-xs font-mono text-muted-foreground">
                                {p.width}×{p.height} {unitLabel} · qty{" "}
                                {p.quantity}
                              </p>
                              {p.stockSheetId && (
                                <p className="text-[10px] text-primary/70 truncate">
                                  ↳{" "}
                                  {stocks.find((s) => s.id === p.stockSheetId)
                                    ?.label ?? ""}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              data-ocid={`pieces.edit_button.${idx + 1}`}
                              aria-label={`Edit ${p.label}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePiece(p.id)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              data-ocid={`pieces.delete_button.${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {pieces.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
                      No pieces added yet
                    </div>
                  )}
                </div>

                {/* Add piece form */}
                <div className="space-y-2 bg-muted/30 rounded-md p-2.5 border border-border">
                  <Input
                    value={newPiece.label}
                    onChange={(e) =>
                      setNewPiece((p) => ({ ...p, label: e.target.value }))
                    }
                    placeholder="Label"
                    className="h-7 text-xs"
                    data-ocid="pieces.input"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        W ({unitLabel})
                      </Label>
                      <Input
                        type="number"
                        value={newPiece.width}
                        onChange={(e) =>
                          setNewPiece((p) => ({ ...p, width: e.target.value }))
                        }
                        placeholder="0"
                        className="h-7 text-xs font-mono"
                        data-ocid="pieces.input"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        H ({unitLabel})
                      </Label>
                      <Input
                        type="number"
                        value={newPiece.height}
                        onChange={(e) =>
                          setNewPiece((p) => ({ ...p, height: e.target.value }))
                        }
                        placeholder="0"
                        className="h-7 text-xs font-mono"
                        data-ocid="pieces.input"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Qty
                      </Label>
                      <Input
                        type="number"
                        value={newPiece.quantity}
                        onChange={(e) =>
                          setNewPiece((p) => ({
                            ...p,
                            quantity: e.target.value,
                          }))
                        }
                        placeholder="1"
                        min="1"
                        className="h-7 text-xs font-mono"
                        data-ocid="pieces.input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      Stock Sheet (optional)
                    </Label>
                    <select
                      value={newPiece.stockSheetId}
                      onChange={(e) =>
                        setNewPiece((p) => ({
                          ...p,
                          stockSheetId: e.target.value,
                        }))
                      }
                      className="w-full h-7 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      data-ocid="pieces.select"
                    >
                      <option value="">Any sheet</option>
                      {stocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                          {s.laminateFront || s.laminateBack
                            ? ` [F: ${s.laminateFront || "—"} / B: ${s.laminateBack || "—"}]`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={addPiece}
                    size="sm"
                    variant="secondary"
                    className="w-full h-7 text-xs gap-1.5"
                    data-ocid="pieces.add_button"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Piece
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Options */}
              <section>
                <h2 className="font-display font-semibold text-sm text-foreground mb-3">
                  Options
                </h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowRotation}
                      onChange={(e) => setAllowRotation(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                      data-ocid="options.rotation.checkbox"
                    />
                    <span className="text-xs text-foreground">
                      Allow piece rotation
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={considerKerf}
                      onChange={(e) => setConsiderKerf(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                      data-ocid="options.kerf.checkbox"
                    />
                    <span className="text-xs text-foreground">
                      Consider blade thickness (kerf)
                    </span>
                  </label>
                  {considerKerf && (
                    <div className="flex items-center gap-2 pl-6">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                        Blade thickness ({unitLabel})
                      </Label>
                      <Input
                        type="number"
                        value={kerfValue}
                        onChange={(e) => setKerfValue(e.target.value)}
                        placeholder="3"
                        min="0"
                        step="0.1"
                        className="h-7 text-xs font-mono w-20"
                        data-ocid="options.kerf.input"
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Optimize Button — sticky at bottom */}
          <div className="p-4 border-t border-border bg-sidebar">
            <Button
              onClick={runOptimize}
              className="w-full gap-2 font-semibold shadow-glow"
              data-ocid="optimize.primary_button"
            >
              <Zap className="w-4 h-4" />
              Optimize Cutlist
            </Button>
          </div>
        </aside>

        {/* RIGHT PANEL — Results */}
        <main className="flex-1 overflow-auto" data-ocid="results.panel">
          {result ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 space-y-6"
            >
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Sheets Used",
                    value: result.totalSheets,
                    mono: true,
                  },
                  {
                    label: "Utilization",
                    value: `${result.utilization.toFixed(1)}%`,
                    mono: true,
                  },
                  {
                    label: "Used Area",
                    value: `${(result.usedArea / 1e6).toFixed(3)} m²`,
                    mono: true,
                  },
                  {
                    label: "Waste Area",
                    value: `${((result.totalArea - result.usedArea) / 1e6).toFixed(3)} m²`,
                    mono: true,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="panel-glass rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      {stat.label}
                    </p>
                    <p
                      className={`text-xl font-bold text-foreground ${stat.mono ? "font-mono" : ""}`}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Overall utilization bar */}
              <div className="panel-glass rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Overall Material Utilization
                  </span>
                  <span className="font-mono text-sm text-primary font-bold">
                    {result.utilization.toFixed(1)}%
                  </span>
                </div>
                <Progress value={result.utilization} className="h-2" />
              </div>

              {/* Unplaced pieces warning */}
              {result.unplacedPieces.length > 0 && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      Some pieces could not be placed
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.unplacedPieces
                        .map((u) => `${u.label} (×${u.qty})`)
                        .join(", ")}{" "}
                      — pieces exceed stock sheet dimensions
                    </p>
                  </div>
                </div>
              )}

              {/* Ply Summary */}
              {(() => {
                const plySummary: Record<
                  string,
                  {
                    label: string;
                    width: number;
                    height: number;
                    count: number;
                    laminateFront: string;
                    laminateBack: string;
                    assignedPieceLabels: string[];
                  }
                > = {};
                for (const sheet of result.sheets) {
                  const matchedStock = stocks.find(
                    (s) =>
                      s.id === sheet.stockSheetId ||
                      (s.label === sheet.sheetLabel &&
                        s.width === sheet.sheetWidth &&
                        s.height === sheet.sheetHeight),
                  );
                  const laminateFront = matchedStock?.laminateFront ?? "";
                  const laminateBack = matchedStock?.laminateBack ?? "";
                  const key = `${sheet.sheetLabel}__${sheet.sheetWidth}x${sheet.sheetHeight}__${laminateFront}__${laminateBack}`;
                  if (!plySummary[key]) {
                    plySummary[key] = {
                      label: sheet.sheetLabel,
                      width: sheet.sheetWidth,
                      height: sheet.sheetHeight,
                      count: 0,
                      laminateFront,
                      laminateBack,
                      assignedPieceLabels: [],
                    };
                  }
                  plySummary[key].count += 1;
                }
                // Collect piece labels assigned to each stock sheet key
                for (const piece of pieces) {
                  if (piece.stockSheetId) {
                    const assignedStock = stocks.find(
                      (s) => s.id === piece.stockSheetId,
                    );
                    if (assignedStock) {
                      const lf = assignedStock.laminateFront ?? "";
                      const lb = assignedStock.laminateBack ?? "";
                      const k = `${assignedStock.label}__${assignedStock.width}x${assignedStock.height}__${lf}__${lb}`;
                      if (
                        plySummary[k] &&
                        !plySummary[k].assignedPieceLabels.includes(piece.label)
                      ) {
                        plySummary[k].assignedPieceLabels.push(piece.label);
                      }
                    }
                  }
                }
                const rows = Object.values(plySummary);
                // Aggregate laminate sheets required per laminate material
                const laminateTotals: Record<string, number> = {};
                for (const r of rows) {
                  if (r.laminateFront) {
                    laminateTotals[r.laminateFront] =
                      (laminateTotals[r.laminateFront] || 0) + r.count;
                  }
                  if (r.laminateBack) {
                    laminateTotals[r.laminateBack] =
                      (laminateTotals[r.laminateBack] || 0) + r.count;
                  }
                }
                const laminateRows = Object.entries(laminateTotals).sort(
                  (a, b) => a[0].localeCompare(b[0]),
                );
                const handleDownload = () => {
                  const header =
                    "Sheet Type,Width,Height,Min Qty Required,Front Laminate,Back Laminate,Assigned Pieces";
                  const csvRows = rows.map(
                    (r) =>
                      `"${r.label}",${r.width},${r.height},${r.count},"${r.laminateFront || "-"}","${r.laminateBack || "-"}","${r.assignedPieceLabels.length > 0 ? r.assignedPieceLabels.join("; ") : "-"}"`,
                  );
                  const laminateHeader =
                    "\n\nLaminate Material,Sheets Required";
                  const laminateCsvRows = laminateRows.map(
                    ([name, count]) => `"${name}",${count}`,
                  );
                  const csv = [
                    header,
                    ...csvRows,
                    laminateHeader,
                    ...laminateCsvRows,
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "ply-summary.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                };
                return (
                  <div
                    className="panel-glass rounded-xl p-5 space-y-3"
                    data-ocid="ply.section"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Ply Summary
                      </h2>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                        className="gap-2"
                        data-ocid="ply.download_button"
                      >
                        <Download className="w-4 h-4" />
                        Download CSV
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-ocid="ply.table">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                              Sheet Type
                            </th>
                            <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                              Width
                            </th>
                            <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                              Height
                            </th>
                            <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                              Front Lam.
                            </th>
                            <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                              Back Lam.
                            </th>
                            <th className="text-right py-2 pr-4 text-muted-foreground font-medium">
                              Min Qty
                            </th>
                            <th className="text-left py-2 text-muted-foreground font-medium">
                              Assigned Pieces
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr
                              key={r.label}
                              className="border-b border-border/20 last:border-0"
                              data-ocid={`ply.row.${i + 1}`}
                            >
                              <td className="py-2 pr-4 font-medium text-foreground">
                                {r.label}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono text-foreground">
                                {unit === "mm"
                                  ? r.width
                                  : (r.width / 25.4).toFixed(2)}
                                &nbsp;{unit}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono text-foreground">
                                {unit === "mm"
                                  ? r.height
                                  : (r.height / 25.4).toFixed(2)}
                                &nbsp;{unit}
                              </td>
                              <td className="py-2 pr-4 text-right text-xs text-foreground">
                                {r.laminateFront &&
                                r.laminateFront &&
                                r.laminateFront !== ""
                                  ? r.laminateFront
                                  : "—"}
                              </td>
                              <td className="py-2 pr-4 text-right text-xs text-foreground">
                                {r.laminateBack &&
                                r.laminateBack &&
                                r.laminateBack !== ""
                                  ? r.laminateBack
                                  : "—"}
                              </td>
                              <td className="py-2 pr-4 text-right font-mono font-bold text-primary">
                                {r.count}
                              </td>
                              <td className="py-2 text-left text-xs text-muted-foreground">
                                {r.assignedPieceLabels.length > 0
                                  ? r.assignedPieceLabels.join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {laminateRows.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/30">
                        <h3 className="text-sm font-semibold text-foreground mb-2">
                          Laminate Sheets Required
                        </h3>
                        <table
                          className="w-full text-sm"
                          data-ocid="laminate.summary.table"
                        >
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Laminate Material
                              </th>
                              <th className="text-right py-2 text-muted-foreground font-medium">
                                Sheets Required
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {laminateRows.map(([name, count], i) => (
                              <tr
                                key={name}
                                className="border-b border-border/20 last:border-0"
                                data-ocid={`laminate.summary.row.${i + 1}`}
                              >
                                <td className="py-2 pr-4 text-foreground">
                                  {name}
                                </td>
                                <td className="py-2 text-right font-mono font-bold text-primary">
                                  {count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sheet diagrams */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Sheet Layout ({result.totalSheets} sheet
                    {result.totalSheets !== 1 ? "s" : ""})
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadLayoutPDF}
                    className="gap-2"
                    data-ocid="layout.download_pdf_button"
                  >
                    <FileDown className="w-4 h-4" />
                    Download PDF
                  </Button>
                </div>
                {result.sheets.map((sheet) => (
                  <motion.div
                    key={sheet.sheetIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sheet.sheetIndex * 0.08 }}
                    className="panel-glass rounded-xl p-5"
                  >
                    <SheetDiagram sheet={sheet} unit={unit} />
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="panel-glass rounded-lg p-4">
                <h3 className="font-display text-sm font-semibold text-foreground mb-3">
                  Piece Legend
                </h3>
                <div className="flex flex-wrap gap-2">
                  {pieces.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1"
                    >
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{
                          backgroundColor:
                            PIECE_COLORS[idx % PIECE_COLORS.length].fill,
                        }}
                      />
                      <span className="text-xs text-foreground">{p.label}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {p.width}×{p.height}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div
              className="h-full flex flex-col items-center justify-center gap-6 text-center p-8"
              data-ocid="results.empty_state"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative"
              >
                {/* Decorative grid pattern */}
                <div className="absolute inset-0 -m-12 opacity-20">
                  <svg
                    width="200"
                    height="200"
                    viewBox="0 0 200 200"
                    aria-hidden="true"
                    role="presentation"
                  >
                    {Array.from({ length: 25 }).map((_, k) => (
                      <rect
                        key={`dec-${(k % 5) * 40 + 2}-${Math.floor(k / 5) * 40 + 2}`}
                        x={(k % 5) * 40 + 2}
                        y={Math.floor(k / 5) * 40 + 2}
                        width={36}
                        height={36}
                        fill="none"
                        stroke="#c8a84a"
                        strokeWidth={1}
                        rx={2}
                        opacity={k % 2 === 0 ? 0.6 : 0.3}
                      />
                    ))}
                  </svg>
                </div>
                <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <Scissors className="w-10 h-10 text-primary" />
                </div>
              </motion.div>

              <div className="space-y-2 max-w-sm">
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Ready to Optimize
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Add your stock sheets and required pieces on the left panel,
                  then click{" "}
                  <span className="text-primary font-semibold">
                    Optimize Cutlist
                  </span>{" "}
                  to see the optimal cutting layout with minimal waste.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md w-full">
                {[
                  {
                    icon: Layers,
                    label: "Define Sheets",
                    desc: "Add stock material dimensions",
                  },
                  {
                    icon: Scissors,
                    label: "List Pieces",
                    desc: "Enter required cut pieces",
                  },
                  {
                    icon: Zap,
                    label: "Optimize",
                    desc: "Get the best cutting layout",
                  },
                ].map(({ icon: Icon, label, desc }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="panel-glass rounded-lg p-3 text-center"
                  >
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-xs font-semibold text-foreground">
                      {label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Projects Dialog */}
      <Dialog open={showProjects} onOpenChange={setShowProjects}>
        <DialogContent className="max-w-lg" data-ocid="project.dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Saved Projects</DialogTitle>
          </DialogHeader>
          {projectsLoading ? (
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-ocid="project.loading_state"
            >
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div
              className="py-8 text-center text-sm text-muted-foreground"
              data-ocid="project.empty_state"
            >
              No saved projects yet. Optimize a cutlist and save it!
            </div>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {projects.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border cursor-pointer transition-colors ${
                      activeProjectId === p.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-accent/30"
                    }`}
                    data-ocid={`project.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.sheets.length} sheet
                        {p.sheets.length !== 1 ? "s" : ""} · {p.pieces.length}{" "}
                        piece{p.pieces.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        if (stocks.length > 0 || pieces.length > 0) {
                          setShowProjects(false);
                          setPendingProjectLoad(p);
                        } else {
                          loadProject(p);
                        }
                      }}
                    >
                      Load
                    </Button>
                    <button
                      type="button"
                      onClick={() => deleteProject.mutate(p.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      data-ocid={`project.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProjects(false)}
              data-ocid="project.close_button"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>
            Guillotine bin packing · Supports rotation · Area-first heuristic
          </span>
        </div>
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          © {new Date().getFullYear()} Built with ❤️ using caffeine.ai
        </a>
      </footer>

      {/* New Project Confirmation Dialog */}
      <AlertDialog
        open={showNewProjectConfirm}
        onOpenChange={setShowNewProjectConfirm}
      >
        <AlertDialogContent data-ocid="new_project.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new project?</AlertDialogTitle>
            <AlertDialogDescription>
              Starting a new project will clear the current workspace. Any
              unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="new_project.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setStocks([]);
                setPieces([]);
                setResult(null);
                setProjectName("");
                setCurrentProjectId(null);
                setActiveProjectId(null);
                setLaminateOptions([]);
                setShowNewProjectConfirm(false);
                toast.success("New project started.");
              }}
              data-ocid="new_project.confirm_button"
            >
              <FilePlus className="w-3.5 h-3.5 mr-1.5" />
              New Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Project Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm" data-ocid="project.save_dialog">
          <DialogHeader>
            <DialogTitle className="font-display">Save Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="save-project-name" className="text-sm">
              Project name
            </Label>
            <Input
              id="save-project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Kitchen Cabinet"
              className="h-8 text-sm"
              data-ocid="project.save_dialog.input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveProject();
                  setShowSaveDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveDialog(false)}
              data-ocid="project.save_dialog.cancel_button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                const ok = await saveProject();
                if (ok) setShowSaveDialog(false);
              }}
              disabled={createProject.isPending}
              data-ocid="project.save_dialog.submit_button"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {createProject.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingProjectLoad !== null}
        onOpenChange={(open) => {
          if (!open) setPendingProjectLoad(null);
        }}
      >
        <AlertDialogContent data-ocid="load_project.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Load project?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current workspace has unsaved changes. Loading a new project
              will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="load_project.cancel_button"
              onClick={() => setPendingProjectLoad(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="load_project.confirm_button"
              onClick={() => {
                if (pendingProjectLoad) {
                  loadProject(pendingProjectLoad);
                }
                setPendingProjectLoad(null);
              }}
            >
              Discard & Load
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster richColors />
    </div>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  );
}
