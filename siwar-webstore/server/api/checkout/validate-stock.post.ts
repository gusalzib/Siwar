// server/api/checkout/validate-stock.post.ts
import { isValidObjectId } from 'mongoose'
import { Product } from '../../../server/models/Product'
import {
  evaluateCheckoutStock,
  type CartItemValidationInput,
  type CheckoutStockValidationResult,
} from '../../../server/services/inventory.service'


interface ValidateStockRequestBody {
    items: CartItemValidationInput[]
}
/**
 * When the browser or frontend sends an HTTP request to /api/checkout/validate-stock, this interface guarantees that the 
 * JSON payload over the wire looks like this:
 * {
    "items": [
        {
        "productId": "65fa2c9e83b1d2001e4a9f12",
        "requestedQuantity": 2
        },
        {
        "productId": "65fa2c9e83b1d2001e4a9f15",
        "requestedQuantity": 1
        }
    ]
    }
 */

export default defineEventHandler(
    async (event): Promise<CheckoutStockValidationResult> => {
        // Read and parse the JSON payload from the POST request body
        const body = await readBody<ValidateStockRequestBody>(event)
        const cartItems = body?.items;

        // Validate incoming request body structure
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Cart items array is required'
            })
        }

        // Extract IDs and filter out invalid ObjectIds 
        const productIds = cartItems.map((item) => item.productId).filter((id) => isValidObjectId(id)); 

        // Batch-fetch only the requested items from MongoDB in a single query
        const liveProducts = await Product.find({
            _id: { $in: productIds },
        }).select('_id stockQuantity safetyBuffer').lean();

        // Evaluate the cart using the pure service function
        const validationResult = evaluateCheckoutStock(cartItems, liveProducts);

        // If in-store sales reduced available stock below the requested quantities, 
        // return HTTP 409 Conflict so the frontend halts checkout progression
        if (!validationResult.isValid) {
            setResponseStatus(event, 409);
        }

        return validationResult; 
    }
) 


