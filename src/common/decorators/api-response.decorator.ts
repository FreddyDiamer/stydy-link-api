import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiResponseOptions } from '@nestjs/swagger';

export const ApiSuccessResponse = <TModel extends Type<any>>(
  model?: TModel,
  options?: Omit<ApiResponseOptions, 'type' | 'status'>,
) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      type: model,
      description: 'Operation successful',
      ...options,
    }),
  );
};

export const ApiCreatedResponse = <TModel extends Type<any>>(
  model?: TModel,
  options?: Omit<ApiResponseOptions, 'type' | 'status'>,
) => {
  return applyDecorators(
    ApiResponse({
      status: 201,
      type: model,
      description: 'Resource created successfully',
      ...options,
    }),
  );
};

export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  options?: Omit<ApiResponseOptions, 'type' | 'status'>,
) => {
  return applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Paginated results',
      schema: {
        allOf: [
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: `#/components/schemas/${model.name}` },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        ],
      },
      ...options,
    }),
  );
};
