export interface StockSheet {
  id: string;
  label: string;
  width: number;
  height: number;
  quantity: number;
}

export interface CutPiece {
  id: string;
  label: string;
  width: number;
  height: number;
  quantity: number;
}

export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  pieceId: string;
  colorIndex: number;
}

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OptimizedSheet {
  sheetIndex: number;
  sheetLabel: string;
  sheetWidth: number;
  sheetHeight: number;
  placedPieces: PlacedPiece[];
  freeRects: FreeRect[];
  usedArea: number;
  totalArea: number;
  utilization: number;
}

export interface OptimizationResult {
  sheets: OptimizedSheet[];
  totalSheets: number;
  totalArea: number;
  usedArea: number;
  utilization: number;
  unplacedPieces: Array<{ label: string; qty: number }>;
}

function rectFits(pw: number, ph: number, fw: number, fh: number): boolean {
  return pw <= fw && ph <= fh;
}

function guillotineSplit(
  freeRect: FreeRect,
  pw: number,
  ph: number,
): FreeRect[] {
  const result: FreeRect[] = [];
  const rightW = freeRect.w - pw;
  const topH = freeRect.h - ph;

  // Choose split axis: maximize the larger remaining rectangle
  // Short-axis split rule: split along shorter remaining axis
  const splitHorizontal = rightW > topH;

  if (splitHorizontal) {
    // Right rectangle
    if (rightW > 0 && freeRect.h > 0) {
      result.push({
        x: freeRect.x + pw,
        y: freeRect.y,
        w: rightW,
        h: freeRect.h,
      });
    }
    // Top rectangle (above placed piece, left portion)
    if (pw > 0 && topH > 0) {
      result.push({ x: freeRect.x, y: freeRect.y + ph, w: pw, h: topH });
    }
  } else {
    // Top rectangle (full width)
    if (freeRect.w > 0 && topH > 0) {
      result.push({
        x: freeRect.x,
        y: freeRect.y + ph,
        w: freeRect.w,
        h: topH,
      });
    }
    // Right rectangle (below top)
    if (rightW > 0 && ph > 0) {
      result.push({ x: freeRect.x + pw, y: freeRect.y, w: rightW, h: ph });
    }
  }

  return result;
}

function findBestFreeRect(
  freeRects: FreeRect[],
  pw: number,
  ph: number,
  allowRotation: boolean,
): { index: number; rotated: boolean } | null {
  let bestIndex = -1;
  let bestRotated = false;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < freeRects.length; i++) {
    const fr = freeRects[i];

    // Try normal orientation
    if (rectFits(pw, ph, fr.w, fr.h)) {
      // Best short-side fit heuristic
      const score = Math.min(fr.w - pw, fr.h - ph);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
        bestRotated = false;
      }
    }

    // Try rotated
    if (allowRotation && pw !== ph && rectFits(ph, pw, fr.w, fr.h)) {
      const score = Math.min(fr.w - ph, fr.h - pw);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
        bestRotated = true;
      }
    }
  }

  if (bestIndex === -1) return null;
  return { index: bestIndex, rotated: bestRotated };
}

export function optimize(
  stocks: StockSheet[],
  pieces: CutPiece[],
  allowRotation = true,
): OptimizationResult {
  // Expand pieces by quantity, sorted by area descending
  const allPieces: Array<{ piece: CutPiece; colorIndex: number }> = [];
  for (let idx = 0; idx < pieces.length; idx++) {
    const p = pieces[idx];
    for (let q = 0; q < p.quantity; q++) {
      allPieces.push({ piece: p, colorIndex: idx % 12 });
    }
  }

  // Sort by area desc
  allPieces.sort((a, b) => {
    const areaA = a.piece.width * a.piece.height;
    const areaB = b.piece.width * b.piece.height;
    return areaB - areaA;
  });

  // Expand available stock sheets
  const availableSheets: Array<{ sheet: StockSheet; remaining: number }> = [];
  for (const s of stocks) {
    availableSheets.push({ sheet: s, remaining: s.quantity });
  }

  const optimizedSheets: OptimizedSheet[] = [];
  const unplacedPieces: Array<{ label: string; qty: number }> = [];

  // Open sheets as we go
  const openSheets: Array<{
    sheetDef: StockSheet;
    freeRects: FreeRect[];
    placedPieces: PlacedPiece[];
    sheetIndex: number;
  }> = [];

  function openNewSheet(): (typeof openSheets)[0] | null {
    // Find available stock with remaining quantity
    for (const avail of availableSheets) {
      if (avail.remaining > 0) {
        avail.remaining--;
        const sh = {
          sheetDef: avail.sheet,
          freeRects: [
            { x: 0, y: 0, w: avail.sheet.width, h: avail.sheet.height },
          ],
          placedPieces: [] as PlacedPiece[],
          sheetIndex: optimizedSheets.length + openSheets.length,
        };
        openSheets.push(sh);
        return sh;
      }
    }
    return null;
  }

  for (const { piece, colorIndex } of allPieces) {
    let placed = false;

    // Try existing open sheets
    for (const sh of openSheets) {
      const fit = findBestFreeRect(
        sh.freeRects,
        piece.width,
        piece.height,
        allowRotation,
      );
      if (fit) {
        const fr = sh.freeRects[fit.index];
        const pw = fit.rotated ? piece.height : piece.width;
        const ph = fit.rotated ? piece.width : piece.height;

        sh.placedPieces.push({
          label: piece.label,
          x: fr.x,
          y: fr.y,
          w: pw,
          h: ph,
          rotated: fit.rotated,
          pieceId: piece.id,
          colorIndex,
        });

        const newRects = guillotineSplit(fr, pw, ph);
        sh.freeRects.splice(fit.index, 1, ...newRects);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Open a new sheet
      const newSheet = openNewSheet();
      if (newSheet) {
        const fit = findBestFreeRect(
          newSheet.freeRects,
          piece.width,
          piece.height,
          allowRotation,
        );
        if (fit) {
          const fr = newSheet.freeRects[fit.index];
          const pw = fit.rotated ? piece.height : piece.width;
          const ph = fit.rotated ? piece.width : piece.height;

          newSheet.placedPieces.push({
            label: piece.label,
            x: fr.x,
            y: fr.y,
            w: pw,
            h: ph,
            rotated: fit.rotated,
            pieceId: piece.id,
            colorIndex,
          });

          const newRects = guillotineSplit(fr, pw, ph);
          newSheet.freeRects.splice(fit.index, 1, ...newRects);
          placed = true;
        }
      }

      if (!placed) {
        // Piece doesn't fit on any sheet — record as unplaced
        const existing = unplacedPieces.find((u) => u.label === piece.label);
        if (existing) existing.qty++;
        else unplacedPieces.push({ label: piece.label, qty: 1 });
      }
    }
  }

  // Finalize all open sheets
  let totalArea = 0;
  let usedArea = 0;

  for (const sh of openSheets) {
    const sheetTotalArea = sh.sheetDef.width * sh.sheetDef.height;
    const sheetUsedArea = sh.placedPieces.reduce(
      (sum, p) => sum + p.w * p.h,
      0,
    );
    totalArea += sheetTotalArea;
    usedArea += sheetUsedArea;

    optimizedSheets.push({
      sheetIndex: sh.sheetIndex,
      sheetLabel: sh.sheetDef.label,
      sheetWidth: sh.sheetDef.width,
      sheetHeight: sh.sheetDef.height,
      placedPieces: sh.placedPieces,
      freeRects: sh.freeRects,
      usedArea: sheetUsedArea,
      totalArea: sheetTotalArea,
      utilization:
        sheetTotalArea > 0 ? (sheetUsedArea / sheetTotalArea) * 100 : 0,
    });
  }

  return {
    sheets: optimizedSheets,
    totalSheets: optimizedSheets.length,
    totalArea,
    usedArea,
    utilization: totalArea > 0 ? (usedArea / totalArea) * 100 : 0,
    unplacedPieces,
  };
}
