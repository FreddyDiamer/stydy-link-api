import {
  TeacherDto,
  GroupDto,
  ScheduleLessonDto,
} from '../../dto/parsed-data.dto';
import { normalizeError } from './logger';

export class KaiApiClient {
  private readonly teachersUrl = 'https://kai.ru/web/sotrudniku/raspisanie';
  private readonly groupsUrl = 'https://kai.ru/web/studentu/raspisanie1';

  private readonly defaultHeaders = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  async getTeachers(query: string): Promise<TeacherDto[]> {
    if (!query) {
      throw new Error('Query parameter is required for getTeachers');
    }

    const params = new URLSearchParams({
      p_p_id: 'pubLecturerSchedule_WAR_publicLecturerSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getLecturersURL',
      query,
    });

    try {
      const response = await fetch(`${this.teachersUrl}?${params}`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          Referer: this.teachersUrl,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch teachers: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as TeacherDto[];

      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    } catch (error) {
      const err = normalizeError(error);
      throw new Error(`Error fetching teachers: ${err.message}`);
    }
  }

  async getGroups(query: string): Promise<GroupDto[]> {
    if (!query) {
      throw new Error('Query parameter is required for getGroups');
    }

    const params = new URLSearchParams({
      p_p_id: 'pubStudentSchedule_WAR_publicStudentSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'getGroupsURL',
      query,
    });

    try {
      const response = await fetch(`${this.groupsUrl}?${params}`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          Referer: this.groupsUrl,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch groups: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as GroupDto[];

      if (!Array.isArray(data)) {
        return [];
      }

      return data;
    } catch (error) {
      const err = normalizeError(error);
      throw new Error(`Error fetching groups: ${err.message}`);
    }
  }

  async getSchedule(
    groupId: string,
    programForm: string,
  ): Promise<ScheduleLessonDto[]> {
    if (!groupId || !programForm) {
      throw new Error('groupId and programForm are required for getSchedule');
    }

    const params = new URLSearchParams({
      p_p_id: 'pubStudentSchedule_WAR_publicStudentSchedule10',
      p_p_lifecycle: '2',
      p_p_resource_id: 'schedule',
    });

    const body = new URLSearchParams();
    body.append('groupId', groupId);
    body.append('programForm', programForm);

    try {
      const response = await fetch(`${this.groupsUrl}?${params}`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Referer: this.groupsUrl,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch schedule: ${response.status} ${response.statusText}`,
        );
      }

      const result = (await response.json()) as ScheduleLessonDto[];

      return Object.values(result).flat();
    } catch (error) {
      const err = normalizeError(error);
      throw new Error(`Error fetching schedule: ${err.message}`);
    }
  }
}
