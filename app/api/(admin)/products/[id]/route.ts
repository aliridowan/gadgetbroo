import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { Prisma } from "../../../../../src/generated/prisma/client";
import { MediaService } from "@/lib/services/mediaService";
import { updateProductSchema } from "../../../../../zodSchemas/productSchema";
import { checkPermission } from "../../../../../lib/rbac";
import { ProductService } from "../../../../../lib/services/productService";
import { sanitizeHtml } from "../../../../../lib/sanitizeHtml";


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Products", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const product = await ProductService.getProductById(id);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Products", "canUpdate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    
    const result = updateProductSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });

    const { variants, ...productData } = result.data;

    // Same write-time sanitization as product creation — this is a partial
    // update, so only touch it if this particular PATCH actually included a
    // description.
    if (productData.description !== undefined) {
      productData.description = sanitizeHtml(productData.description);
    }

    if (productData.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: productData.slug } });
      if (existing && existing.id !== id) return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    if (variants && variants.length > 0) {
      const skus = variants.map((v) => v.sku).filter(Boolean) as string[];
      const existingSkus = await prisma.productVariant.findMany({
        where: { sku: { in: skus }, productId: { not: id } },
        select: { sku: true },
      });
      if (existingSkus.length > 0) return NextResponse.json({ error: `SKU already exists: ${existingSkus.map(s => s.sku).join(", ")}` }, { status: 400 });
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Auto-generate SKUs and Names if missing
      const processedVariants = variants ? variants.map((v, index) => {
        let variantName = v.name;
        if (!variantName) {
          variantName = v.attributes && Object.values(v.attributes).length > 0 
            ? Object.values(v.attributes).join(" - ") 
            : "Default Variant";
        }
        
        let sku = v.sku;
        if (!sku) {
          const baseSlug = productData.slug || id.substring(0, 8);
          let attrHash = index.toString().padStart(2, '0');
          if (v.attributes && Object.keys(v.attributes).length > 0) {
            const crypto = require("crypto");
            attrHash = crypto.createHash('md5').update(JSON.stringify(v.attributes)).digest('hex').substring(0, 6).toUpperCase();
          }
          sku = `${baseSlug.toUpperCase().substring(0, 10)}-${attrHash}`.replace(/[^A-Z0-9-]/g, "");
        }

        return { ...v, name: variantName, sku };
      }) : undefined;

      if (processedVariants) {
        const existingVariants = await tx.productVariant.findMany({ where: { productId: id, isDeleted: false } });
        const existingVariantIds = existingVariants.map(v => v.id);
        const incomingIds = processedVariants.map(v => v.id).filter(Boolean) as string[];

        const variantsToDelete = existingVariantIds.filter(vId => !incomingIds.includes(vId));
        
        for (const vId of variantsToDelete) {
          const hasOrders = await tx.orderItem.count({ where: { variantId: vId } });
          if (hasOrders > 0) {
            await tx.productVariant.update({ where: { id: vId }, data: { isDeleted: true, deletedAt: new Date(), sku: `del-${vId}` } });
          } else {
            await tx.productVariant.delete({ where: { id: vId } });
          }
        }

        for (const v of processedVariants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { name: v.name, sku: v.sku, price: v.price, stock: v.stock, attributes: v.attributes ?? Prisma.JsonNull, isActive: v.isActive }
            });
          } else {
            await tx.productVariant.create({
              data: { name: v.name, sku: v.sku!, price: v.price, stock: v.stock, attributes: v.attributes ?? Prisma.JsonNull, isActive: v.isActive, productId: id }
            });
          }
        }
      }

      // Convert options and tags if necessary
      const updateData: any = { ...productData };
      if (updateData.options === null) updateData.options = Prisma.JsonNull;
      if (updateData.options && typeof updateData.options === 'object') {
        updateData.options = updateData.options; // JSONB
      }

      return await tx.product.update({
        where: { id },
        data: updateData,
        include: { variants: { where: { isDeleted: false } } }
      });
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("PATCH /api/products/[id] error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkPermission("Products", "canDelete");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { select: { id: true, mediaFileId: true, mediaFile: { select: { fileId: true, id: true } } } },
        variants: { select: { id: true, _count: { select: { orderItems: true } } } },
      },
    });

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const orderItemCount = product.variants.reduce((sum, v) => sum + v._count.orderItems, 0);
    if (orderItemCount > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), slug: `del-${id}` } });
        const variants = await tx.productVariant.findMany({ where: { productId: id } });
        for (const v of variants) {
          await tx.productVariant.update({ where: { id: v.id }, data: { isDeleted: true, deletedAt: new Date(), sku: `del-${v.id}` } });
        }
      });
      return NextResponse.json({ success: true, message: "Product soft-deleted because it exists in previous orders.", softDeleted: true });
    }

    const mediaFileIds = product.images.map((img) => img.mediaFileId);
    
    // 1. Delete the product (this cascades and deletes associated ProductImage and ProductVariant records)
    await prisma.product.delete({ where: { id } });

    // 2. Now check if the MediaFiles are orphaned and delete them
    for (const mediaFileId of mediaFileIds) {
      const usageCount = await prisma.productImage.count({ where: { mediaFileId } });
      if (usageCount === 0) {
        const mf = await prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
        if (mf?.fileId) {
          await MediaService.deleteFile(mf.fileId);
          await prisma.mediaFile.delete({ where: { id: mediaFileId } });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Product and its media permanently deleted", softDeleted: false });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
