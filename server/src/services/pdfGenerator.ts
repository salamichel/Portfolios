import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import type { Book, BookPage, Image, LayoutSlot, PageSlotData, TextSlotData, TextStyle, SlotAnnotation } from '../database.js';

// PDF format configurations (in points, 1 point = 1/72 inch)
// For 300 DPI output, these are the spread (double-page) dimensions
export type PdfFormat = 'landscape' | 'portrait';

interface FormatConfig {
  name: string;
  // Single page dimensions in cm
  pageWidthCm: number;
  pageHeightCm: number;
  // Spread (double page) dimensions in points
  spreadWidth: number;
  spreadHeight: number;
}

// 1 cm = 28.3465 points (72 points/inch * 1 inch/2.54 cm)
const CM_TO_POINTS = 28.3465;

export const PDF_FORMATS: Record<PdfFormat, FormatConfig> = {
  landscape: {
    name: 'Grand paysage - 29.7x21cm',
    pageWidthCm: 29.7,
    pageHeightCm: 21,
    spreadWidth: 29.7 * 2 * CM_TO_POINTS, // 59.4cm = 1683.78 points
    spreadHeight: 21 * CM_TO_POINTS,       // 21cm = 595.28 points
  },
  portrait: {
    name: 'Grand portrait - 21x29.7cm',
    pageWidthCm: 21,
    pageHeightCm: 29.7,
    spreadWidth: 21 * 2 * CM_TO_POINTS,    // 42cm = 1190.55 points
    spreadHeight: 29.7 * CM_TO_POINTS,     // 29.7cm = 841.89 points
  },
};

// Base directory for files
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');
const pdfsDir = path.join(BASE_DIR, 'pdfs');

// Ensure PDF directory exists
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

// Font size mappings (in points)
const FONT_SIZES: Record<string, number> = {
  small: 9,
  medium: 11,
  large: 14,
  xlarge: 20,
};

// Text parsing helpers for rich text
interface TextFragment {
  content: string;
  bold?: boolean;
  italic?: boolean;
}

interface ParsedLine {
  fragments: TextFragment[];
  heading?: 'h1' | 'h2';
}

function parseLineFragments(line: string): TextFragment[] {
  const fragments: TextFragment[] = [];
  let currentIndex = 0;

  while (currentIndex < line.length) {
    // Check for **bold**
    const boldMatch = line.slice(currentIndex).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      fragments.push({ content: boldMatch[1], bold: true });
      currentIndex += boldMatch[0].length;
      continue;
    }

    // Check for *italic*
    const italicMatch = line.slice(currentIndex).match(/^\*([^*]+)\*/);
    if (italicMatch) {
      fragments.push({ content: italicMatch[1], italic: true });
      currentIndex += italicMatch[0].length;
      continue;
    }

    // Regular text
    const nextSpecial = line.slice(currentIndex).search(/\*/);
    if (nextSpecial === -1) {
      if (currentIndex < line.length) {
        fragments.push({ content: line.slice(currentIndex) });
      }
      break;
    } else if (nextSpecial > 0) {
      fragments.push({ content: line.slice(currentIndex, currentIndex + nextSpecial) });
      currentIndex += nextSpecial;
    } else {
      fragments.push({ content: line[currentIndex] });
      currentIndex++;
    }
  }

  return fragments;
}

function parseLine(line: string): ParsedLine {
  if (line.startsWith('# ')) {
    return { fragments: parseLineFragments(line.slice(2)), heading: 'h1' };
  }
  if (line.startsWith('## ')) {
    return { fragments: parseLineFragments(line.slice(3)), heading: 'h2' };
  }
  return { fragments: parseLineFragments(line) };
}

interface GeneratePdfOptions {
  book: Book;
  pages: BookPage[];
  format: PdfFormat;
}

interface PdfResult {
  filename: string;
  filepath: string;
  size: number;
}

export async function generateBookPdf(options: GeneratePdfOptions): Promise<PdfResult> {
  const { book, pages, format } = options;
  const formatConfig = PDF_FORMATS[format];

  const filename = `${book.name.replace(/[^a-zA-Z0-9-_]/g, '_')}_${format}_${Date.now()}.pdf`;
  const filepath = path.join(pdfsDir, filename);

  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF document with spread dimensions
      const doc = new PDFDocument({
        size: [formatConfig.spreadWidth, formatConfig.spreadHeight],
        margin: 0,
        autoFirstPage: false,
      });

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        doc.addPage();

        await renderSpread(doc, page, formatConfig);
      }

      doc.end();

      writeStream.on('finish', () => {
        const stats = fs.statSync(filepath);
        resolve({
          filename,
          filepath,
          size: stats.size,
        });
      });

      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function renderSpread(
  doc: PDFKit.PDFDocument,
  page: BookPage,
  formatConfig: FormatConfig
): Promise<void> {
  const template = page.template;
  const slots = template?.layout?.slots || [];
  const pageData = page.page_data;
  const images = page.images || [];

  // Create image map
  const imageMap = new Map<string, Image>();
  images.forEach(img => imageMap.set(img.id, img));

  // Render each slot
  for (const slot of slots) {
    if (slot.type === 'text') {
      await renderTextSlot(doc, slot, pageData, formatConfig);
    } else {
      await renderImageSlot(doc, slot, pageData, imageMap, formatConfig);
    }
  }
}

function getSlotPosition(slot: LayoutSlot, formatConfig: FormatConfig): { x: number; y: number; width: number; height: number } {
  const isSpanning = slot.width > 100;
  const singlePageWidth = formatConfig.spreadWidth / 2;

  let x: number, width: number;

  if (isSpanning) {
    // Slot spans both pages
    x = (slot.x / 200) * formatConfig.spreadWidth;
    width = (slot.width / 200) * formatConfig.spreadWidth;
  } else if (slot.page === 'left') {
    x = (slot.x / 100) * singlePageWidth;
    width = (slot.width / 100) * singlePageWidth;
  } else {
    // Right page
    x = singlePageWidth + (slot.x / 100) * singlePageWidth;
    width = (slot.width / 100) * singlePageWidth;
  }

  const y = (slot.y / 100) * formatConfig.spreadHeight;
  const height = (slot.height / 100) * formatConfig.spreadHeight;

  return { x, y, width, height };
}

async function renderImageSlot(
  doc: PDFKit.PDFDocument,
  slot: LayoutSlot,
  pageData: BookPage['page_data'],
  imageMap: Map<string, Image>,
  formatConfig: FormatConfig
): Promise<void> {
  const slotData = pageData?.slots?.find(s => s.slot_id === slot.id);
  if (!slotData) return;

  const image = imageMap.get(slotData.image_id);
  if (!image) return;

  const { x, y, width, height } = getSlotPosition(slot, formatConfig);

  // Get original image path
  const imagePath = path.join(uploadsDir, image.filename);

  if (!fs.existsSync(imagePath)) {
    // Try optimized WebP if original not found
    const basename = image.filename.replace(/\.[^.]+$/, '');
    const optimizedPath = path.join(uploadsDir, 'optimized', `${basename}.webp`);
    if (fs.existsSync(optimizedPath)) {
      await renderImageFile(doc, optimizedPath, x, y, width, height);
    }
  } else {
    await renderImageFile(doc, imagePath, x, y, width, height);
  }

  // Render annotation if present
  if (slotData.annotation) {
    renderAnnotation(doc, slotData.annotation, image, x, y, width, height);
  }
}

async function renderImageFile(
  doc: PDFKit.PDFDocument,
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  try {
    // Convert image to PNG buffer for PDFKit compatibility (especially for WebP)
    const imageBuffer = await sharp(imagePath)
      .png()
      .toBuffer();

    // Get image dimensions for aspect ratio calculation
    const metadata = await sharp(imagePath).metadata();
    const imgWidth = metadata.width || 1;
    const imgHeight = metadata.height || 1;
    const imgAspect = imgWidth / imgHeight;
    const slotAspect = width / height;

    let renderWidth = width;
    let renderHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    // Cover mode: fill slot while maintaining aspect ratio
    if (imgAspect > slotAspect) {
      // Image is wider - fit height, crop width
      renderHeight = height;
      renderWidth = height * imgAspect;
      offsetX = (width - renderWidth) / 2;
    } else {
      // Image is taller - fit width, crop height
      renderWidth = width;
      renderHeight = width / imgAspect;
      offsetY = (height - renderHeight) / 2;
    }

    // Save state for clipping
    doc.save();

    // Create clipping rectangle
    doc.rect(x, y, width, height).clip();

    // Draw image centered in slot
    doc.image(imageBuffer, x + offsetX, y + offsetY, {
      width: renderWidth,
      height: renderHeight,
    });

    // Restore state
    doc.restore();
  } catch (error) {
    console.error(`Error rendering image ${imagePath}:`, error);
  }
}

function renderAnnotation(
  doc: PDFKit.PDFDocument,
  annotation: SlotAnnotation,
  image: Image,
  slotX: number,
  slotY: number,
  slotWidth: number,
  slotHeight: number
): void {
  const showAny = annotation.show_title || annotation.show_description || annotation.show_paragraph;
  if (!showAny) return;

  const title = annotation.use_image_metadata && image.title ? image.title : annotation.title;
  const description = annotation.use_image_metadata && image.description ? image.description : annotation.description;
  const paragraph = annotation.paragraph;

  const position = annotation.position || 'bottom';

  // Calculate annotation area
  let annotX = slotX;
  let annotY = slotY;
  let annotWidth = slotWidth;
  let annotHeight = slotHeight;
  const padding = 10;

  switch (position) {
    case 'bottom':
      annotHeight = Math.min(slotHeight * 0.3, 80);
      annotY = slotY + slotHeight - annotHeight;
      break;
    case 'top':
      annotHeight = Math.min(slotHeight * 0.3, 80);
      break;
    case 'overlay':
      // Center overlay
      annotWidth = slotWidth * 0.8;
      annotHeight = Math.min(slotHeight * 0.4, 100);
      annotX = slotX + (slotWidth - annotWidth) / 2;
      annotY = slotY + (slotHeight - annotHeight) / 2;
      break;
    case 'side':
      annotWidth = slotWidth * 0.33;
      annotX = slotX + slotWidth - annotWidth;
      break;
  }

  // Draw semi-transparent background
  doc.save();
  doc.fillColor('black').opacity(0.6);
  doc.rect(annotX, annotY, annotWidth, annotHeight).fill();
  doc.opacity(1);

  // Draw text
  doc.fillColor('white');
  let textY = annotY + padding;
  const textX = annotX + padding;
  const textWidth = annotWidth - padding * 2;

  if (annotation.show_title && title) {
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(title, textX, textY, { width: textWidth, lineGap: 2 });
    textY = doc.y + 4;
  }

  if (annotation.show_description && description) {
    doc.font('Helvetica').fontSize(9);
    doc.text(description, textX, textY, { width: textWidth, lineGap: 2 });
    textY = doc.y + 4;
  }

  if (annotation.show_paragraph && paragraph) {
    doc.font('Helvetica-Oblique').fontSize(9);
    doc.text(paragraph, textX, textY, { width: textWidth, lineGap: 2 });
  }

  doc.restore();
}

async function renderTextSlot(
  doc: PDFKit.PDFDocument,
  slot: LayoutSlot,
  pageData: BookPage['page_data'],
  formatConfig: FormatConfig
): Promise<void> {
  const textData = pageData?.textSlots?.find(s => s.slot_id === slot.id);
  if (!textData || !textData.content?.trim()) return;

  const { x, y, width, height } = getSlotPosition(slot, formatConfig);
  const style = textData.style;
  const padding = 10;

  // Parse color
  const textColor = style?.color || '#1f2937';

  // Get base font size
  const baseFontSize = FONT_SIZES[style?.fontSize || 'medium'];

  // Set font family
  let fontBase = 'Helvetica';
  if (style?.fontFamily === 'serif') {
    fontBase = 'Times-Roman';
  } else if (style?.fontFamily === 'mono') {
    fontBase = 'Courier';
  }

  // Parse text alignment
  const align = style?.textAlign || 'left';

  // Save state
  doc.save();

  // Set up clipping area
  doc.rect(x, y, width, height).clip();

  let textY = y + padding;
  const textX = x + padding;
  const textWidth = width - padding * 2;

  // Parse and render each line
  const lines = textData.content.split('\n');

  for (const line of lines) {
    if (line.trim() === '') {
      textY += baseFontSize * 1.5;
      continue;
    }

    const { fragments, heading } = parseLine(line);

    // Determine font size based on heading
    let fontSize = baseFontSize;
    let isHeading = false;
    if (heading === 'h1') {
      fontSize = 20;
      isHeading = true;
    } else if (heading === 'h2') {
      fontSize = 16;
      isHeading = true;
    }

    // For simple lines without formatting, render directly
    if (fragments.length === 1 && !fragments[0].bold && !fragments[0].italic) {
      const fontName = getFontName(fontBase, isHeading || style?.fontWeight === 'bold', style?.fontStyle === 'italic');
      doc.font(fontName).fontSize(fontSize).fillColor(textColor);
      doc.text(fragments[0].content, textX, textY, { width: textWidth, align: align as 'left' | 'center' | 'right' });
      textY = doc.y + 4;
    } else {
      // Complex line with multiple fragments - render fragment by fragment
      let currentX = textX;

      // For centered/right alignment, we need to calculate total width first
      if (align !== 'left') {
        const totalWidth = fragments.reduce((sum, frag) => {
          const fontName = getFontName(fontBase, frag.bold || isHeading || style?.fontWeight === 'bold', frag.italic || style?.fontStyle === 'italic');
          doc.font(fontName).fontSize(fontSize);
          return sum + doc.widthOfString(frag.content);
        }, 0);

        if (align === 'center') {
          currentX = textX + (textWidth - totalWidth) / 2;
        } else if (align === 'right') {
          currentX = textX + textWidth - totalWidth;
        }
      }

      for (const fragment of fragments) {
        const fontName = getFontName(
          fontBase,
          fragment.bold || isHeading || style?.fontWeight === 'bold',
          fragment.italic || style?.fontStyle === 'italic'
        );
        doc.font(fontName).fontSize(fontSize).fillColor(textColor);
        doc.text(fragment.content, currentX, textY, { continued: true, lineBreak: false });
        currentX += doc.widthOfString(fragment.content);
      }
      doc.text(''); // End the continued text
      textY = doc.y + 4;
    }
  }

  doc.restore();
}

function getFontName(base: string, bold: boolean, italic: boolean): string {
  if (base === 'Helvetica') {
    if (bold && italic) return 'Helvetica-BoldOblique';
    if (bold) return 'Helvetica-Bold';
    if (italic) return 'Helvetica-Oblique';
    return 'Helvetica';
  } else if (base === 'Times-Roman') {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  } else if (base === 'Courier') {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }
  return base;
}

export function getPdfPath(filename: string): string {
  return path.join(pdfsDir, filename);
}

export function pdfExists(filename: string): boolean {
  return fs.existsSync(path.join(pdfsDir, filename));
}

export function deletePdf(filename: string): boolean {
  const filepath = path.join(pdfsDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

export function listBookPdfs(bookName: string): string[] {
  const prefix = bookName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const files = fs.readdirSync(pdfsDir);
  return files.filter(f => f.startsWith(prefix) && f.endsWith('.pdf'));
}
