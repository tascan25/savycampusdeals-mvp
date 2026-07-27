const CARD_WIDTH = 1296;
const CARD_HEIGHT = Math.round(CARD_WIDTH / 1.586);
const DESIGN_WIDTH = 432;
const SCALE = CARD_WIDTH / DESIGN_WIDTH;

const roundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const fitFontSize = (
  ctx,
  text,
  maxWidth,
  preferredSize,
  minimumSize,
  weight,
  family
) => {
  let size = preferredSize;
  do {
    ctx.font = `${weight} ${size}px "${family}", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 0.5;
  } while (size >= minimumSize);
  return minimumSize;
};

const drawSpacedText = (ctx, text, x, y, spacing) => {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
};

const drawCheckBadge = (ctx) => {
  roundedRect(ctx, 322, 24, 86, 27, 14);
  ctx.fillStyle = "rgba(16, 185, 129, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(340, 37.5, 6.5, 0, Math.PI * 2);
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(337.5, 37.5);
  ctx.lineTo(339.5, 39.5);
  ctx.lineTo(343, 35.5);
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = "#6ee7b7";
  ctx.font = '600 11px "Manrope", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText("Verified", 352, 41);
};

const drawSparkle = (ctx) => {
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(181, 61);
  ctx.lineTo(183.5, 66);
  ctx.lineTo(189, 68.5);
  ctx.lineTo(183.5, 71);
  ctx.lineTo(181, 76);
  ctx.lineTo(178.5, 71);
  ctx.lineTo(173, 68.5);
  ctx.lineTo(178.5, 66);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(188.5, 61);
  ctx.lineTo(188.5, 65);
  ctx.moveTo(186.5, 63);
  ctx.lineTo(190.5, 63);
  ctx.stroke();
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export async function createStudentPassPng(card) {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  roundedRect(ctx, 0.5, 0.5, 431, CARD_HEIGHT / SCALE - 1, 24);
  ctx.save();
  ctx.clip();

  ctx.fillStyle = "#0f0a20";
  ctx.fillRect(0, 0, DESIGN_WIDTH, CARD_HEIGHT / SCALE);

  const purple = ctx.createRadialGradient(43, 28, 0, 43, 28, 260);
  purple.addColorStop(0, "rgba(126, 34, 206, 0.58)");
  purple.addColorStop(0.65, "rgba(88, 28, 135, 0.12)");
  purple.addColorStop(1, "rgba(88, 28, 135, 0)");
  ctx.fillStyle = purple;
  ctx.fillRect(0, 0, DESIGN_WIDTH, CARD_HEIGHT / SCALE);

  const blue = ctx.createRadialGradient(382, 45, 0, 382, 45, 230);
  blue.addColorStop(0, "rgba(37, 99, 235, 0.42)");
  blue.addColorStop(0.7, "rgba(30, 64, 175, 0.08)");
  blue.addColorStop(1, "rgba(30, 64, 175, 0)");
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, DESIGN_WIDTH, CARD_HEIGHT / SCALE);

  const green = ctx.createRadialGradient(260, 282, 0, 260, 282, 210);
  green.addColorStop(0, "rgba(22, 163, 74, 0.26)");
  green.addColorStop(1, "rgba(22, 163, 74, 0)");
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, DESIGN_WIDTH, CARD_HEIGHT / SCALE);
  ctx.restore();

  roundedRect(ctx, 0.5, 0.5, 431, CARD_HEIGHT / SCALE - 1, 24);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = '500 10px "Manrope", sans-serif';
  drawSpacedText(ctx, "SAVVYCAMPUSDEALS", 24, 42, 2.2);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 24px "Outfit", sans-serif';
  ctx.fillText("Student Pass", 24, 79);
  drawSparkle(ctx);
  drawCheckBadge(ctx);

  ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
  ctx.font = '500 10px "Manrope", sans-serif';
  drawSpacedText(ctx, "NAME", 24, 119, 2.5);

  const studentName = String(card.name || "—");
  const nameSize = fitFontSize(
    ctx,
    studentName,
    268,
    19,
    13,
    700,
    "Outfit"
  );
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${nameSize}px "Outfit", sans-serif`;
  ctx.fillText(studentName, 24, 145);

  ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
  ctx.font = '500 10px "Manrope", sans-serif';
  drawSpacedText(ctx, "COLLEGE", 24, 171, 2.5);

  const college = String(card.college || "—");
  const collegeSize = fitFontSize(
    ctx,
    college,
    268,
    14,
    9.5,
    500,
    "Manrope"
  );
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `500 ${collegeSize}px "Manrope", sans-serif`;
  ctx.fillText(college, 24, 195);

  roundedRect(ctx, 316, 102, 92, 92, 12);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (card.qr_data_uri) {
    const qrImage = await loadImage(card.qr_data_uri);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, 322, 108, 80, 80);
    ctx.imageSmoothingEnabled = true;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.font = '500 10px "Manrope", sans-serif';
  drawSpacedText(ctx, "ID", 24, 232, 2.5);
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(String(card.student_number || "—"), 24, 250);

  const expiry = card.expiry
    ? new Date(card.expiry).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : "—";
  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.font = '500 10px "Manrope", sans-serif';
  const validTill = "VALID TILL";
  const validWidth = Array.from(validTill).reduce(
    (width, character) => width + ctx.measureText(character).width + 2.5,
    -2.5
  );
  ctx.textAlign = "left";
  drawSpacedText(ctx, validTill, 408 - validWidth, 232, 2.5);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 11px "Manrope", sans-serif';
  ctx.fillText(expiry, 408, 250);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png"
    );
  });
}
