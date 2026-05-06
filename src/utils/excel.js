// ============================================
// Excel 精算書エクスポート (ExcelJS + FileSaver)
// ============================================
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * 交通費精算書をXLSXファイルとしてエクスポートする
 * 
 * @param {Array} filteredRecords - フィルタリング済みの記録データ
 * @param {string} filterStartDate - 開始日 (YYYY-MM-DD)
 * @param {string} filterEndDate - 終了日 (YYYY-MM-DD)
 */
export const exportToXLSX = async (filteredRecords, filterStartDate, filterEndDate) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('交通費精算書');

  // --- データ準備 ---
  const recordsByDate = {};
  let grandTotalDistance = 0;

  filteredRecords.forEach(r => {
    if (!recordsByDate[r.date]) recordsByDate[r.date] = [];
    recordsByDate[r.date].push(r);
    grandTotalDistance += r.distance;
  });
  const sortedDates = Object.keys(recordsByDate).sort();

  // その日の最大移動回数を取得
  let maxMoves = 0;
  sortedDates.forEach(date => {
    recordsByDate[date].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (recordsByDate[date].length > maxMoves) maxMoves = recordsByDate[date].length;
  });

  // 合計列数: 日付(1) + (場所+距離) × maxMoves + 日計(1)
  const totalCols = 1 + (maxMoves * 2) + 1;
  const lastColLetter = worksheet.getColumn(totalCols).letter;
  const borderStyle = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  let currentRow = 1;

  // --- タイトル ---
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "交通費精算書";
  titleCell.font = { size: 18, bold: true, name: 'ＭＳ Ｐゴシック' };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  currentRow += 2;

  // --- 申請者情報 ---
  worksheet.getCell(`A${currentRow}`).value = "期間:";
  worksheet.getCell(`B${currentRow}`).value = `${filterStartDate} 〜 ${filterEndDate}`;
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = "所属:";
  worksheet.getCell(`B${currentRow}`).value = "　　　　　　　　　";
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = "氏名:";
  worksheet.getCell(`B${currentRow}`).value = "　　　　　　　　　";
  currentRow += 2;

  // --- 総移動距離 ---
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const totalDistLabel = worksheet.getCell(`A${currentRow}`);
  totalDistLabel.value = `総移動距離: ${Math.round(grandTotalDistance)} km`;
  totalDistLabel.font = { size: 20, bold: true };
  totalDistLabel.alignment = { horizontal: 'left', vertical: 'bottom' };
  currentRow += 2;

  // --- テーブルヘッダー ---
  const headerValues = ["日付"];
  for (let i = 1; i <= maxMoves; i++) {
    headerValues.push(`場所${i}`, `距離${i}(km)`);
  }
  headerValues.push("日計(km)");

  const tableHeaderRow = worksheet.getRow(currentRow);
  tableHeaderRow.values = headerValues;
  tableHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });
  currentRow++;

  // --- データ行 ---
  sortedDates.forEach(date => {
    const dayRecords = recordsByDate[date];
    const rowData = [date];
    let dayTotal = 0;

    dayRecords.forEach(r => {
      rowData.push(r.destination || "", r.distance);
      dayTotal += r.distance;
    });

    // 空白埋め
    const remaining = maxMoves - dayRecords.length;
    for (let i = 0; i < remaining; i++) rowData.push("", "");
    rowData.push(dayTotal);

    const row = worksheet.getRow(currentRow);
    row.values = rowData;
    row.eachCell((cell, colNum) => {
      cell.border = borderStyle;
      cell.alignment = {
        horizontal: (colNum === 1 || colNum === rowData.length || colNum % 2 !== 0) ? 'center' : 'left'
      };
    });
    currentRow++;
  });

  // --- 合計行 ---
  const totalRowData = ["期間合計"];
  for (let i = 0; i < maxMoves * 2; i++) totalRowData.push("");
  totalRowData.push(grandTotalDistance);

  const totalRow = worksheet.getRow(currentRow);
  totalRow.values = totalRowData;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    cell.border = borderStyle;
  });
  totalRow.getCell(headerValues.length).numFmt = '0';

  // --- カラム幅 ---
  worksheet.columns.forEach((col, i) => {
    if (i === 0) col.width = 15;
    else if (i === headerValues.length - 1) col.width = 12;
    else if (i % 2 !== 0) col.width = 20;
    else col.width = 8;
  });

  // --- ファイル生成・ダウンロード ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, `交通費精算書_${filterStartDate}_${filterEndDate}.xlsx`);
};
