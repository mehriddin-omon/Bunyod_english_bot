import {JwtPayload} from "../guard/jwt/jwt-auth.guard"

declare module 'express-serve-static-core' {
    interface Request {
        user?: JwtPayload
    }
}