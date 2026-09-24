// server/api/products/[id]/availability.get.ts

import { isValidObjectId } from "mongoose";
import { Product } from "~~/server/models/Product";
import { getProductAvailability, type ProductAvailability } from "~~/server/services/inventory.service";

export default defineEventHandler(async (event): Promise<ProductAvailability> => {
    // Extract the dynamic route parameter [id] from the request URL
    const id = getRouterParam(event, 'id')

    // Validate that the ID is a valid MongoDB 24-char hexadecimal ObjectId
    // createError halts execution and send a formatted JSON error response to the client
    if (!id || !isValidObjectId(id)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid product ID format'
        })
    }

    // Query MongoDB Atlas for the product
    //  .select('stockQuantity safetyBuffer'): only retrieves the 2 fields needed for stock math
    //  .lean(): returns a plain JS object rather than hydrating a heavy mongoose document 
    const product = await Product.findById(id).select('stockQuantity safetyBuffer').lean();

    // Return 404 if no product matches this ID 
    if (!product) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Product not found'
        })
    }
    // Run the domain logic from inventory.service.ts and return the results
    return getProductAvailability(product); 
})