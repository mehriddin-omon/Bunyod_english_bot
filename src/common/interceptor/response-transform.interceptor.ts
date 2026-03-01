import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            map(data => {
                const ctx = context.switchToHttp();
                const response = ctx.getResponse();
                // Agar data obyekt va unda message yoki data maydonlari bo'lsa, ularni ajratib olamiz
                let message = 'Success';
                let responseData = data;
                if (data && typeof data === 'object') {
                    if ('message' in data) {
                        message = data.message;
                        // message maydonini olib tashlab, qolganini data sifatida beramiz
                        const {
                            message: _,
                            ...rest
                        } = data;
                        responseData = Object.keys(rest).length ? rest : undefined;
                    }
                }
                return {
                    statusCode: response.statusCode || 200,
                    message,
                    data: responseData,
                };
            })
        );
    }
}
