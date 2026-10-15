import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../types/api-response.type';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        message: 'Operation successful',
        success: true,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// Результат: все ответы будут в формате:
// {
//   "data": { ... },
//   "message": "Operation successful",
//   "success": true,
//   "timestamp": "2024-01-01T00:00:00.000Z"
// }
