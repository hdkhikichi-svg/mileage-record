// ============================================
// CSV パーサー
// ============================================

/**
 * CSVテキストをパースして距離マトリクス・地点リスト・住所マップを返す
 * 
 * 期待するCSV形式:
 *   ヘッダー行: 地点名, 住所, 地点1, 地点2, ...
 *   データ行:   新宿支店, 東京都新宿区..., 0, 5.2, ...
 * 
 * @param {string} csvText - CSVテキスト
 * @returns {{ locationList: string[], distanceMatrix: Object, addressMap: Object }}
 * @throws {Error} パース失敗時
 */
export const parseCSV = (csvText) => {
  const lines = csvText
    .split(/\r\n|\n/)
    .map(line => line.trim())
    .filter(line => line);

  const newMatrix = {};
  const newLocationList = [];
  const newAddressMap = {};

  const parsedLines = lines.map(l => l.split(','));

  // ヘッダー行（"住所"列）を探す
  let dataStartIndex = -1;
  for (let i = 0; i < parsedLines.length; i++) {
    const row = parsedLines[i];
    if (row.length > 1 && row[1] && row[1].includes("住所")) {
      dataStartIndex = i + 1;
      break;
    }
  }

  // ヘッダーが見つからない場合のフォールバック
  if (dataStartIndex === -1) {
    for (let i = 0; i < parsedLines.length; i++) {
      if (
        parsedLines[i].length > 2 &&
        parsedLines[i][0] &&
        !parsedLines[i][0].includes("距離単位") &&
        !parsedLines[i][0].includes("※")
      ) {
        dataStartIndex = i;
        break;
      }
    }
  }

  if (dataStartIndex === -1 || dataStartIndex >= parsedLines.length) {
    throw new Error("有効なデータが見つかりませんでした。CSVの形式を確認してください。");
  }

  // 地点名と住所の抽出
  for (let i = dataStartIndex; i < parsedLines.length; i++) {
    const row = parsedLines[i];
    if (row.length > 0 && row[0]) {
      const name = row[0].trim();
      newLocationList.push(name);
      if (row[1]) {
        newAddressMap[name] = row[1].trim();
      }
    }
  }

  // 距離マトリクスの構築
  for (let i = 0; i < newLocationList.length; i++) {
    const fromName = newLocationList[i];
    newMatrix[fromName] = {};
    const row = parsedLines[dataStartIndex + i];
    if (!row) continue;

    for (let j = 0; j < newLocationList.length; j++) {
      const toName = newLocationList[j];
      const colIndex = 2 + j;
      let dist = 0;
      if (colIndex < row.length) {
        const val = row[colIndex];
        if (val && !isNaN(parseFloat(val))) {
          dist = parseFloat(val);
        }
      }
      newMatrix[fromName][toName] = dist;
    }
  }

  return {
    locationList: newLocationList,
    distanceMatrix: newMatrix,
    addressMap: newAddressMap
  };
};
