import {} from 'drizzle-orm';
export const aliasedColumn = (column, alias) => {
    return column.getSQL().mapWith(column.mapFromDriverValue).as(alias);
};
