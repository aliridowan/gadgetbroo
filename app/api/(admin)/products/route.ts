// app/api/(admin)/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../src/generated/prisma/client";
import prisma from "../../../../lib/prisma";
import { checkPermission } from "../../../../lib/rbac";
import { createProductSchema } from "../../../../zodSchemas/productSchema";
import { ProductService } from "../../../../lib/services/productService";
import { sanitizeHtml } from "../../../../lib/sanitizeHtml";

export async function GET(request: NextRequest) {
  try {
    const session = await checkPermission("Products", "canView");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);

    const result = await ProductService.getProducts({
      search: searchParams.get("search") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      featured: searchParams.get("featured") ?? undefined,
      stock: searchParams.get("stock") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await checkPermission("Products", "canCreate");
    if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const result = createProductSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { variants, ...productData } = result.data;

    // Strip anything the TiptapEditor toolbar can't actually produce (script
    // tags, event handler attributes, javascript: URLs, etc.) before this
    // ever reaches the database — the write path is the one choke point
    // ALL product descriptions pass through, so sanitizing here protects
    // every current and future place that renders it.
    productData.description = sanitizeHtml(productData.description);

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({
      where: { slug: productData.slug },
    });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    // Auto-generate SKUs and Names if missing
    const processedVariants = variants.map((v, index) => {
      let variantName = v.name;
      if (!variantName) {
        variantName = v.attributes && Object.values(v.attributes).length > 0 
          ? Object.values(v.attributes).join(" - ") 
          : "Default Variant";
      }
      
      let sku = v.sku;
      if (!sku) {
        const baseSlug = productData.slug;
        let attrHash = index.toString().padStart(2, '0');
        if (v.attributes && Object.keys(v.attributes).length > 0) {
          const crypto = require("crypto");
          attrHash = crypto.createHash('md5').update(JSON.stringify(v.attributes)).digest('hex').substring(0, 6).toUpperCase();
        }
        sku = `${baseSlug.toUpperCase().substring(0, 10)}-${attrHash}`.replace(/[^A-Z0-9-]/g, "");
      }

      return { ...v, name: variantName, sku };
    });

    // Check SKU uniqueness across all variants
    const skus = processedVariants.map((v) => v.sku);
    const existingSkus = await prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });
    if (existingSkus.length > 0) {
      return NextResponse.json(
        { error: `SKU already exists: ${existingSkus.map((s) => s.sku).join(", ")}` },
        { status: 400 }
      );
    }

    // Convert options and tags if necessary
    const createData: any = { ...productData };
    if (createData.options === null) createData.options = Prisma.JsonNull;
    if (createData.options && typeof createData.options === 'object') {
      createData.options = createData.options;
    }

    // Create product with variants in one transaction
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...createData,
          variants: {
            create: processedVariants.map((v) => ({
              name: v.name,
              sku: v.sku,
              price: v.price,
              stock: v.stock,
              attributes: v.attributes ?? Prisma.JsonNull,
              isActive: v.isActive,
            })),
          },
        },
        include: {
          variants: true,
          category: { select: { name: true, slug: true } },
        },
      });
      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
