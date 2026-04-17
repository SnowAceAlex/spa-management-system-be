import { z } from 'zod';

const hhmmssRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const staffScheduleSchemaBase = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(hhmmssRegex, 'startTime must be HH:mm or HH:mm:ss'),
  endTime: z.string().regex(hhmmssRegex, 'endTime must be HH:mm or HH:mm:ss'),
  isWorkingDay: z.boolean().optional(),
});

export const CreateStaffScheduleSchema = staffScheduleSchemaBase.superRefine((data, ctx) => {
  if (data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startTime must be earlier than endTime',
      path: ['startTime'],
    });
  }
});

export const UpdateStaffScheduleSchema = staffScheduleSchemaBase
  .partial()
  .superRefine((data, ctx) => {
    if (!Object.keys(data).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
        path: [],
      });
      return;
    }

    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      if (data.startTime >= data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startTime must be earlier than endTime',
          path: ['startTime'],
        });
      }
    }
  });
