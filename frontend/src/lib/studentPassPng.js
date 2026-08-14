const CARD_WIDTH = 1296;
const DESIGN_WIDTH = 432;
const DESIGN_HEIGHT = Math.round(DESIGN_WIDTH / 1.586);
const CARD_HEIGHT = DESIGN_HEIGHT * (CARD_WIDTH / DESIGN_WIDTH);
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

const fitFontSize = (ctx, text, maxWidth, preferredSize, minimumSize, weight, family) => {
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

const drawBrandMark = (ctx) => {
  roundedRect(ctx, 24, 21, 28, 28, 8);
  ctx.fillStyle = "#f1fffb";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#063f46";
  ctx.font = 'italic 900 15px "Outfit", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("S", 38, 40.5);
  ctx.textAlign = "left";
};

const drawVerifiedBadge = (ctx) => {
  roundedRect(ctx, 322, 23, 86, 26, 13);
  ctx.fillStyle = "rgba(241, 255, 251, 0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(339, 36, 6, 0, Math.PI * 2);
  ctx.strokeStyle = "#064e4d";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(336.5, 36);
  ctx.lineTo(338.5, 38);
  ctx.lineTo(342, 34);
  ctx.strokeStyle = "#064e4d";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = "#063f46";
  ctx.font = '700 10px "Manrope", sans-serif';
  ctx.fillText("Verified", 350, 39.5);
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawBackground = (ctx) => {
  roundedRect(ctx, 0.5, 0.5, DESIGN_WIDTH - 1, DESIGN_HEIGHT - 1, 25);
  ctx.save();
  ctx.clip();

  const base = ctx.createLinearGradient(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  base.addColorStop(0, "#137c79");
  base.addColorStop(0.43, "#075565");
  base.addColorStop(0.72, "#073747");
  base.addColorStop(1, "#0b2837");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  const topGlow = ctx.createRadialGradient(398, 4, 0, 398, 4, 260);
  topGlow.addColorStop(0, "rgba(45, 212, 191, 0.44)");
  topGlow.addColorStop(1, "rgba(45, 212, 191, 0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  const lowerGlow = ctx.createRadialGradient(-20, DESIGN_HEIGHT + 12, 0, -20, DESIGN_HEIGHT + 12, 260);
  lowerGlow.addColorStop(0, "rgba(34, 211, 238, 0.24)");
  lowerGlow.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = lowerGlow;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  ctx.strokeStyle = "rgba(204, 251, 241, 0.040)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 260; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, DESIGN_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= DESIGN_HEIGHT; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(275, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(204, 251, 241, 0.14)";
  ctx.beginPath();
  ctx.arc(408, -30, 106, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(204, 251, 241, 0.045)";
  ctx.beginPath();
  ctx.arc(408, -30, 136, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(240, 253, 250, 0.045)";
  ctx.font = '900 190px "Outfit", sans-serif';
  ctx.fillText("S", 328, 145);
  ctx.restore();

  roundedRect(ctx, 0.5, 0.5, DESIGN_WIDTH - 1, DESIGN_HEIGHT - 1, 25);
  ctx.strokeStyle = "rgba(204, 251, 241, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  roundedRect(ctx, 1.5, 1.5, DESIGN_WIDTH - 3, DESIGN_HEIGHT - 3, 24);
  ctx.strokeStyle = "rgba(204, 251, 241, 0.14)";
  ctx.stroke();
};

export async function createStudentPassPng(card) {
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawBackground(ctx);
  drawBrandMark(ctx);
  drawVerifiedBadge(ctx);

  ctx.fillStyle = "rgba(240, 253, 250, 0.90)";
  ctx.font = '700 8px "Manrope", sans-serif';
  drawSpacedText(ctx, "SAVVY CAMPUS", 62, 32, 1.55);
  ctx.fillStyle = "rgba(240, 253, 250, 0.46)";
  ctx.font = '500 7px "Manrope", sans-serif';
  drawSpacedText(ctx, "STUDENT MEMBERSHIP", 62, 45, 1.15);

  const accentLine = ctx.createLinearGradient(24, 0, 66, 0);
  accentLine.addColorStop(0, "rgba(153, 246, 228, 0.95)");
  accentLine.addColorStop(1, "rgba(103, 232, 249, 0.05)");
  ctx.fillStyle = accentLine;
  ctx.fillRect(24, 113, 42, 1);

  ctx.fillStyle = "rgba(240, 253, 250, 0.46)";
  ctx.font = '600 8px "Manrope", sans-serif';
  drawSpacedText(ctx, "MEMBER", 24, 132, 1.7);

  const studentName = String(card.name || "—");
  const nameSize = fitFontSize(ctx, studentName, 276, 21, 13, 700, "Outfit");
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${nameSize}px "Outfit", sans-serif`;
  ctx.fillText(studentName, 24, 158);

  const college = String(card.college || "—");
  const collegeSize = fitFontSize(ctx, college, 276, 12, 8.5, 500, "Manrope");
  ctx.fillStyle = "rgba(240, 253, 250, 0.72)";
  ctx.font = `500 ${collegeSize}px "Manrope", sans-serif`;
  ctx.fillText(college, 24, 179);

  roundedRect(ctx, 320, 105, 88, 88, 14);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (card.qr_data_uri) {
    const qrImage = await loadImage(card.qr_data_uri);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImage, 326, 111, 76, 76);
    ctx.imageSmoothingEnabled = true;
  }

  ctx.fillStyle = "rgba(240, 253, 250, 0.15)";
  ctx.fillRect(24, 211, 384, 1);

  ctx.fillStyle = "rgba(240, 253, 250, 0.42)";
  ctx.font = '600 7px "Manrope", sans-serif';
  drawSpacedText(ctx, "MEMBER ID", 24, 230, 1.45);
  ctx.fillStyle = "rgba(240, 253, 250, 0.86)";
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(String(card.student_number || "—"), 24, 249);

  const expiry = card.expiry
    ? new Date(card.expiry).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";
  const validThrough = "VALID THROUGH";
  ctx.fillStyle = "rgba(240, 253, 250, 0.42)";
  ctx.font = '600 7px "Manrope", sans-serif';
  const validWidth = Array.from(validThrough).reduce(
    (width, character) => width + ctx.measureText(character).width + 1.45,
    -1.45
  );
  drawSpacedText(ctx, validThrough, 408 - validWidth, 230, 1.45);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(240, 253, 250, 0.86)";
  ctx.font = '600 10px "Manrope", sans-serif';
  ctx.fillText(expiry, 408, 249);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png"
    );
  });
}
